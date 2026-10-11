import { execFile } from 'node:child_process'
import type { PrintEvent, SpoolerStatus } from '@shared/types'
import { nowIso } from '../util/time'
import type { FileService } from './files'
import type { PrintService } from './prints'

/* --------------------------------------------------------------- PowerShell */

/**
 * One-shot probe. Prints a single JSON object on stdout.
 *
 * Two independent signals are collected, because the operational print log is
 * disabled by default on most Windows installs:
 *   1. event id 307 ("Document printed") from Microsoft-Windows-PrintService/Operational
 *   2. the live print queue via Get-PrintJob, where a job that disappears
 *      between two polls is assumed to have been printed.
 */
const PS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'

function Get-PrintField {
  param($Bag, $Names)
  foreach ($n in $Names) {
    if ($Bag.ContainsKey($n) -and $Bag[$n]) { return $Bag[$n] }
  }
  return $null
}

$result = [ordered]@{
  logEnabled = $false
  printers   = @()
  events     = @()
  jobs       = @()
}

try {
  $log = Get-WinEvent -ListLog 'Microsoft-Windows-PrintService/Operational' -ErrorAction Stop
  if ($log -ne $null) { $result.logEnabled = [bool]$log.IsEnabled }
} catch {
  $result.logEnabled = $false
}

try {
  $result.printers = @(Get-Printer -ErrorAction Stop | Select-Object -ExpandProperty Name)
} catch {
  $result.printers = @()
}

if ($result.logEnabled) {
  $list = @()
  $raw = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-PrintService/Operational'; Id = 307 } -MaxEvents 200 -ErrorAction SilentlyContinue)
  foreach ($e in $raw) {
    $data = @{}
    try {
      [xml]$xml = $e.ToXml()
      foreach ($d in @($xml.Event.EventData.Data)) {
        $key = [string]$d.Name
        if ($key) { $data[($key -replace '\s', '')] = [string]$d.'#text' }
      }
    } catch { }

    $list += [pscustomobject]@{
      recordId = [string]$e.RecordId
      jobId    = [string](Get-PrintField $data @('JobId', 'JobID'))
      time     = $e.TimeCreated.ToUniversalTime().ToString('o')
      document = [string](Get-PrintField $data @('DocumentName', 'Document', 'JobName'))
      printer  = [string](Get-PrintField $data @('PrinterName', 'Printer', 'PortName'))
      user     = [string](Get-PrintField $data @('User', 'UserName', 'SubmittedBy'))
      pages    = [string](Get-PrintField $data @('PagesPrinted', 'Pages', 'TotalPages'))
      copies   = [string](Get-PrintField $data @('Copies', 'NumberOfCopies'))
    }
  }
  $result.events = @($list)
}

$jobs = @()
try {
  $jobs = @(Get-PrintJob -PrinterName * -ErrorAction Stop | ForEach-Object {
    [pscustomobject]@{
      id        = [string]$_.Id
      document  = [string]$_.DocumentName
      printer   = [string]$_.PrinterName
      user      = [string]$_.SubmittedBy
      pages     = [string]$_.TotalPages
      status    = [string]$_.JobStatus
      submitted = $_.SubmittedTime.ToUniversalTime().ToString('o')
    }
  })
} catch { }
$result.jobs = @($jobs)

$result | ConvertTo-Json -Depth 6 -Compress
`

const PS_PRINTERS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
@(Get-Printer | Select-Object -ExpandProperty Name) | ConvertTo-Json -Compress
`

interface RawEvent {
  recordId?: string
  jobId?: string
  time?: string
  document?: string
  printer?: string
  user?: string
  pages?: string
  copies?: string
}

interface RawJob {
  id?: string
  document?: string
  printer?: string
  user?: string
  pages?: string
  status?: string
  submitted?: string
}

interface ProbeResult {
  logEnabled?: boolean
  printers?: string[]
  events?: RawEvent[]
  jobs?: RawJob[]
}

const DEFAULT_POLL_MS = 5000
const MIN_POLL_MS = 2000
/** Ignore event-log rows older than this so a first run does not backfill ancient history. */
const MAX_EVENT_AGE_MS = 1000 * 60 * 60 * 24 * 7

function runPowerShell(script: string, timeoutMs = 25000): Promise<string> {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    execFile(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encoded
      ],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message).trim() || 'PowerShell invocation failed'))
          return
        }
        resolve(stdout)
      }
    )
  })
}

function toInt(value: unknown): number | null {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export interface SpoolerCallbacks {
  onStatus(status: SpoolerStatus): void
  onPrintRecorded(event: PrintEvent): void
}

export class SpoolerService {
  private readonly supported = process.platform === 'win32'
  private status: SpoolerStatus
  private timer: NodeJS.Timeout | null = null
  private polling = false
  private previousJobs = new Map<string, RawJob>()
  /** Jobs already captured from the event log, so queue polling does not duplicate them. */
  private readonly recordedJobKeys = new Set<string>()

  constructor(
    private readonly files: FileService,
    private readonly prints: PrintService,
    private readonly callbacks: SpoolerCallbacks
  ) {
    this.status = {
      supported: this.supported,
      running: false,
      logEnabled: null,
      pollIntervalMs: DEFAULT_POLL_MS,
      printers: [],
      lastPollAt: null,
      lastError: this.supported
        ? null
        : 'Print spooler monitoring is only available on Windows. Use folder watching or manual entries instead.',
      lastErrorAt: null
    }
  }

  getStatus(): SpoolerStatus {
    return { ...this.status, printers: [...this.status.printers] }
  }

  start(intervalMs?: number): SpoolerStatus {
    if (!this.supported) return this.getStatus()

    this.status.pollIntervalMs = Math.max(
      MIN_POLL_MS,
      intervalMs ?? this.status.pollIntervalMs ?? DEFAULT_POLL_MS
    )
    this.stopTimer()
    this.status.running = true
    void this.poll()
    this.timer = setInterval(() => {
      void this.poll()
    }, this.status.pollIntervalMs)
    this.emit()
    return this.getStatus()
  }

  stop(): SpoolerStatus {
    this.stopTimer()
    this.status.running = false
    this.emit()
    return this.getStatus()
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async poll(): Promise<SpoolerStatus> {
    if (!this.supported || this.polling) return this.getStatus()
    this.polling = true

    try {
      const stdout = await runPowerShell(PS_SCRIPT)
      const trimmed = stdout.replace(/^\uFEFF/, '').trim()

      if (trimmed.startsWith('{')) {
        const probe = JSON.parse(trimmed) as ProbeResult
        this.status.logEnabled = probe.logEnabled ?? false
        this.status.printers = (probe.printers ?? []).filter((p): p is string => Boolean(p))
        this.status.lastPollAt = nowIso()
        this.status.lastError = null
        this.status.lastErrorAt = null

        this.ingestEvents(probe.events ?? [])
        this.ingestJobs(probe.jobs ?? [])
      }
    } catch (error) {
      this.status.lastError = (error as Error).message
      this.status.lastErrorAt = nowIso()
    } finally {
      this.polling = false
    }

    this.emit()
    return this.getStatus()
  }

  async listPrinters(): Promise<string[]> {
    if (!this.supported) return []
    try {
      const stdout = await runPowerShell(PS_PRINTERS_SCRIPT, 15000)
      const trimmed = stdout.replace(/^\uFEFF/, '').trim()
      if (!trimmed) return []
      const parsed: unknown = JSON.parse(trimmed)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      return list.filter((p): p is string => typeof p === 'string' && p.length > 0)
    } catch {
      return []
    }
  }

  /* ------------------------------------------------------------- ingestion */

  private ingestEvents(events: RawEvent[]): void {
    for (const raw of events) {
      const printer = (raw.printer ?? '').trim() || null
      const jobKey = printer && raw.jobId ? `${printer}:${raw.jobId}` : null
      if (jobKey) this.recordedJobKeys.add(jobKey)

      const printedAt = raw.time && !Number.isNaN(Date.parse(raw.time)) ? raw.time : nowIso()
      if (Date.now() - Date.parse(printedAt) > MAX_EVENT_AGE_MS) continue

      const event = this.recordSpoolerPrint({
        documentName: (raw.document ?? '').trim() || '(unnamed document)',
        printer,
        userName: (raw.user ?? '').trim() || null,
        pages: toInt(raw.pages),
        copies: toInt(raw.copies) ?? 1,
        printedAt,
        externalId: `spooler:event:${raw.recordId ?? `${printedAt}:${raw.document ?? ''}`}`,
        note: 'Reported by the Windows print spooler event log'
      })
      if (event) this.callbacks.onPrintRecorded(event)
    }
  }

  private ingestJobs(jobs: RawJob[]): void {
    const current = new Map<string, RawJob>()

    for (const job of jobs) {
      if (!job.id) continue
      const printer = (job.printer ?? '').trim()
      current.set(`${printer}:${job.id}`, job)
    }

    for (const [key, job] of this.previousJobs) {
      if (current.has(key)) continue
      if (this.recordedJobKeys.has(key)) continue

      const printer = (job.printer ?? '').trim() || null
      const event = this.recordSpoolerPrint({
        documentName: (job.document ?? '').trim() || '(unnamed document)',
        printer,
        userName: (job.user ?? '').trim() || null,
        pages: toInt(job.pages),
        copies: 1,
        printedAt: nowIso(),
        externalId: `spooler:job:${key}`,
        status: job.status ?? null,
        note: 'Print job left the Windows print queue (completed or cancelled)'
      })
      if (event) this.callbacks.onPrintRecorded(event)
    }

    this.previousJobs = current
  }

  private recordSpoolerPrint(input: {
    documentName: string
    printer: string | null
    userName: string | null
    pages: number | null
    copies: number
    printedAt: string
    externalId: string
    status?: string | null
    note: string
  }): PrintEvent | null {
    const match = this.files.findByDocumentName(input.documentName)

    return this.prints.record({
      fileId: match?.id ?? null,
      source: 'spooler',
      printer: input.printer,
      documentName: input.documentName,
      userName: input.userName,
      pages: input.pages,
      copies: input.copies,
      status: input.status ?? null,
      note: input.note,
      printedAt: input.printedAt,
      externalId: input.externalId
    })
  }

  private emit(): void {
    this.callbacks.onStatus(this.getStatus())
  }
}
