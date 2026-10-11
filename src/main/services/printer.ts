import { execFile } from 'node:child_process'
import { accessSync, constants, existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import type {
  MessageKey,
  PrintFileResult,
  PrintMethod,
  PrinterInfo,
  PrintReport,
  PrintRequestInput
} from '@shared/types'
import type { FileService } from './files'
import type { PrintService } from './prints'

/** Runs a command and resolves its stdout; rejects with a readable message. */
export type CommandRunner = (file: string, args: string[], timeoutMs: number) => Promise<string>

/** Resolves an executable on PATH, or null. Indirected so tests can stub it. */
export type BinaryFinder = (name: string) => string | null

export interface PrinterServiceOptions {
  platform?: NodeJS.Platform
  run?: CommandRunner
  findBinary?: BinaryFinder
}

const COPY_LIMIT = 99
const COMMAND_TIMEOUT_MS = 30_000

/** Locate an executable the way a shell would, without shelling out to do it. */
function findOnPath(name: string): string | null {
  const searchPath = process.env['PATH'] ?? ''
  for (const directory of searchPath.split(delimiter)) {
    if (!directory) continue
    const candidate = join(directory, name)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      /* keep looking */
    }
  }
  return null
}

function defaultRunner(file: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr || error.message || '').trim()
          reject(new Error(detail || 'The print command failed.'))
          return
        }
        resolve(stdout)
      }
    )
  })
}

/**
 * Hands files to the operating system to print.
 *
 * There is no portable way to print a document, so this defers to whatever the
 * machine already has: the registered print verb on Windows, CUPS elsewhere.
 * Both are fire-and-forget at this level - the command succeeds once the job is
 * queued, which is why a successful queue is what gets recorded as a print.
 */
export class PrinterService {
  private readonly platform: NodeJS.Platform
  private readonly run: CommandRunner
  private readonly findBinary: BinaryFinder

  constructor(
    private readonly files: FileService,
    private readonly prints: PrintService,
    options: PrinterServiceOptions = {}
  ) {
    this.platform = options.platform ?? process.platform
    this.run = options.run ?? defaultRunner
    this.findBinary = options.findBinary ?? findOnPath
  }

  /** How this machine can print, which the UI uses to explain itself. */
  method(): PrintMethod {
    if (this.platform === 'win32') return 'windows'
    if (this.findBinary('lp')) return 'cups'
    return 'unsupported'
  }

  async listPrinters(): Promise<PrinterInfo[]> {
    const method = this.method()
    try {
      if (method === 'windows') return await this.listWindowsPrinters()
      if (method === 'cups') return await this.listCupsPrinters()
    } catch {
      // A printer list is a convenience; failing to read it must not stop the
      // user printing to the system default.
      return []
    }
    return []
  }

  /**
   * Queues each file, recording a print event for the ones that made it.
   *
   * Failures are per-file rather than fatal: one unsupported file type should
   * not stop the rest of the selection from printing.
   */
  async print(input: PrintRequestInput): Promise<PrintReport> {
    const method = this.method()
    const printer = input.printer?.trim() || null
    const copies = Math.min(COPY_LIMIT, Math.max(1, Math.round(Number(input.copies ?? 1)) || 1))
    const results: PrintFileResult[] = []

    if (method === 'unsupported') {
      for (const fileId of input.fileIds) {
        const file = this.files.get(fileId)
        results.push({
          fileId,
          name: file?.name ?? String(fileId),
          ok: false,
          errorKey: 'print.error.unsupported'
        })
      }
      return { method, printer, results }
    }

    for (const fileId of input.fileIds) {
      const file = this.files.get(fileId)
      if (!file) {
        results.push({ fileId, name: String(fileId), ok: false, errorKey: 'print.error.unknown' })
        continue
      }

      // Files vanish: the index outlives what it points at. Check before
      // handing the path to the OS so the message is ours, not theirs.
      if (!existsSync(file.path)) {
        results.push({ fileId, name: file.name, ok: false, errorKey: 'print.error.missing' })
        continue
      }

      try {
        await this.sendOne(method, file.path, printer, copies)
        // Only a job that actually reached the queue is recorded, which is why
        // the event is written after the command rather than before it.
        this.prints.record({ fileId, source: 'app', printer, copies })
        results.push({ fileId, name: file.name, ok: true })
      } catch (error) {
        const message = (error as Error).message
        results.push({
          fileId,
          name: file.name,
          ok: false,
          error: message,
          errorKey: this.classify(message)
        })
      }
    }

    return { method, printer, results }
  }

  private async sendOne(
    method: PrintMethod,
    path: string,
    printer: string | null,
    copies: number
  ): Promise<void> {
    if (method === 'windows') {
      await this.sendWindows(path, printer)
      return
    }

    const lp = this.findBinary('lp')
    if (!lp) throw new Error('lp is not available.')

    const args: string[] = []
    if (printer) args.push('-d', printer)
    if (copies > 1) args.push('-n', String(copies))
    // `--` stops lp reading a path that begins with a dash as an option.
    args.push('--', path)
    await this.run(lp, args, COMMAND_TIMEOUT_MS)
  }

  /**
   * Windows prints through the file's registered handler, which is what makes
   * this work for PDFs and Word documents without shipping a renderer. The
   * trade-off is that a machine with no handler for the file type cannot print
   * it at all, which the error message has to convey.
   */
  private sendWindows(path: string, printer: string | null): Promise<string> {
    const verb = printer ? 'PrintTo' : 'Print'
    const argument = printer ? ` -ArgumentList @(${quotePowerShell(printer)})` : ''
    const script =
      `$ErrorActionPreference = 'Stop'\n` +
      `Start-Process -FilePath ${quotePowerShell(path)} -Verb ${verb}${argument} -PassThru | Out-Null\n`

    // Encoded as UTF-16LE so the path never passes through a shell parser.
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    return this.run(
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
      COMMAND_TIMEOUT_MS
    )
  }

  private async listWindowsPrinters(): Promise<PrinterInfo[]> {
    const script =
      `$ErrorActionPreference = 'SilentlyContinue'\n` +
      `$default = (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name\n` +
      `Get-Printer | ForEach-Object { [pscustomobject]@{ name = $_.Name; default = ($_.Name -eq $default) } } | ConvertTo-Json -Compress\n`

    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const stdout = await this.run(
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
      15_000
    )

    return parseWindowsPrinters(stdout)
  }

  private async listCupsPrinters(): Promise<PrinterInfo[]> {
    const lpstat = this.findBinary('lpstat')
    if (!lpstat) return []

    const [all, defaultOut] = await Promise.all([
      this.run(lpstat, ['-a'], 10_000),
      this.run(lpstat, ['-d'], 10_000).catch(() => '')
    ])

    const defaultName = /:\s*(\S+)/.exec(defaultOut)?.[1] ?? null
    return all
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[0] ?? '')
      .filter((name) => name.length > 0)
      .map((name) => ({ name, isDefault: name === defaultName }))
  }

  /** Turns an OS message into something we can translate, where we can. */
  private classify(message: string): MessageKey | undefined {
    if (/no application is associated|no associated app|verb/i.test(message)) {
      return 'print.error.noHandler'
    }
    return undefined
  }
}

/** A PowerShell single-quoted string: literal except for doubled quotes. */
function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** `Get-Printer` piped through `ConvertTo-Json` yields an object for one
 *  printer and an array for several. */
export function parseWindowsPrinters(stdout: string): PrinterInfo[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []
  try {
    const parsed: unknown = JSON.parse(trimmed)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row) => ({
        name: String(row['name'] ?? '').trim(),
        isDefault: row['default'] === true
      }))
      .filter((printer) => printer.name.length > 0)
  } catch {
    return []
  }
}
