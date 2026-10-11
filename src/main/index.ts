import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow, app, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { PrintEvent, SpoolerStatus, ToastMessage } from '@shared/types'
import { createApp, type AppContext } from './app'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null
let ctx: AppContext | null = null
let filesChangedTimer: NodeJS.Timeout | null = null

function broadcast(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

/**
 * A large folder scan produces thousands of watcher events. Coalesce the
 * "something changed, please refetch" signal so the renderer is not flooded.
 */
function scheduleFilesChanged(): void {
  if (filesChangedTimer) return
  filesChangedTimer = setTimeout(() => {
    filesChangedTimer = null
    broadcast(IPC.events.filesChanged)
  }, 400)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    title: 'Print Tracker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[renderer] failed to load ${url}: ${description} (${code})`)
  })

  // Diagnostic probe: `PT_DEBUG=1 npm run dev` reports whether the renderer
  // actually mounted and received the preload bridge.
  if (process.env['PT_DEBUG']) {
    mainWindow.webContents.on('did-finish-load', () => {
      // React resolves settings over IPC, so sample the DOM once it has settled.
      setTimeout(() => {
        void mainWindow?.webContents
          .executeJavaScript(
            `({
               hasApi: typeof window.api === 'object' && window.api !== null,
               apiKeys: window.api ? Object.keys(window.api).sort() : [],
               mounted: Boolean(document.querySelector('.app')),
               htmlLang: document.documentElement.lang,
               navLabels: Array.from(document.querySelectorAll('.nav-item')).map((element) =>
                 (element.textContent || '').trim()
               )
             })`
          )
          .then((state: unknown) => {
            console.log('[pt-debug] renderer state:', JSON.stringify(state))
          })
          .catch((error: unknown) => {
            console.error('[pt-debug] probe failed:', error)
          })
      }, 1500)

      // `PT_DEBUG_SHOT=/tmp/ui.png` writes one PNG per screen. Handy when you
      // cannot look at the window directly (remote box, CI, bug report).
      const shotPath = process.env['PT_DEBUG_SHOT']
      if (shotPath) {
        const base = shotPath.replace(/\.png$/i, '')
        const tabs = [
          'overview',
          'dashboard',
          'folders',
          'files',
          'history',
          'query',
          'settings'
        ]

        setTimeout(() => {
          void (async () => {
            // `PT_DEBUG_SEARCH=lib` types a term into the search box before the
            // overview/files shots, so search behaviour can be inspected from a
            // screenshot. React ignores a plain `value =` assignment, so the
            // native setter is used and an `input` event dispatched.
            const searchTerm = process.env['PT_DEBUG_SEARCH']
            const searchTabs = new Set(['overview', 'files'])

            for (let index = 0; index < tabs.length; index++) {
              if (index > 0) {
                await mainWindow?.webContents.executeJavaScript(
                  `document.querySelectorAll('.nav-item')[${index}]?.click()`
                )
              }
              await new Promise((resolve) => setTimeout(resolve, 900))

              if (searchTerm && searchTabs.has(tabs[index])) {
                await mainWindow?.webContents.executeJavaScript(
                  `(() => {
                     const input = document.querySelector('.search')
                     if (!input) return 'no search box'
                     const setter = Object.getOwnPropertyDescriptor(
                       window.HTMLInputElement.prototype, 'value'
                     ).set
                     setter.call(input, ${JSON.stringify(searchTerm)})
                     input.dispatchEvent(new Event('input', { bubbles: true }))
                     return 'typed'
                   })()`
                )
                // Longer than the 250 ms debounce plus the refetch.
                await new Promise((resolve) => setTimeout(resolve, 900))
              }

              // `PT_DEBUG_RESET=open` shows the reset dialog on the settings
              // shot; `PT_DEBUG_RESET=apply` also types the confirmation and
              // clicks through, so the whole wipe can be exercised end to end.
              const resetMode = process.env['PT_DEBUG_RESET']
              if (resetMode && tabs[index] === 'settings') {
                const fill = (selector: string, value: string): string => `(() => {
                   const element = document.querySelector(${JSON.stringify(selector)})
                   if (!element) return 'missing'
                   const proto = element instanceof HTMLTextAreaElement
                     ? HTMLTextAreaElement.prototype
                     : HTMLInputElement.prototype
                   Object.getOwnPropertyDescriptor(proto, 'value').set.call(
                     element,
                     ${JSON.stringify(value)}
                   )
                   element.dispatchEvent(new Event('input', { bubbles: true }))
                   return 'set'
                 })()`

                await mainWindow?.webContents.executeJavaScript(
                  `document.querySelector('.danger-zone .btn.danger')?.click()`
                )
                await new Promise((resolve) => setTimeout(resolve, 900))

                if (resetMode === 'apply') {
                  await mainWindow?.webContents.executeJavaScript(fill('#reset-confirm', 'RESET'))
                  await new Promise((resolve) => setTimeout(resolve, 400))
                  await mainWindow?.webContents.executeJavaScript(
                    `document.querySelector('.modal-foot .btn.danger')?.click()`
                  )
                  // Wipe, then the reload main schedules 400 ms later.
                  await new Promise((resolve) => setTimeout(resolve, 3000))
                }
              }

              // `PT_DEBUG_RESTORE=<row>` opens the restore dialog for that
              // backup row, so the file check can be inspected from a shot.
              const restoreRow = process.env['PT_DEBUG_RESTORE']
              if (restoreRow && tabs[index] === 'settings') {
                await mainWindow?.webContents.executeJavaScript(
                  `document.querySelectorAll('.list-item')[${Number(restoreRow)}]
                     ?.querySelector('.btn.tiny:not(.danger)')?.click()`
                )
                await new Promise((resolve) => setTimeout(resolve, 1200))
              }

              // `PT_DEBUG_HELP=1` expands the "what is this page?" explainer,
              // which is otherwise behind a click on every screen.
              if (process.env['PT_DEBUG_HELP']) {
                await mainWindow?.webContents.executeJavaScript(
                  `document.querySelectorAll('.page-help').forEach((node) => {
                     node.open = true
                   })`
                )
                await new Promise((resolve) => setTimeout(resolve, 300))
              }

              const image = await mainWindow?.webContents.capturePage()
              if (image) {
                const file = `${base}-${tabs[index]}.png`
                writeFileSync(file, image.toPNG())
                console.log('[pt-debug] screenshot:', file)
              }
            }
          })().catch((error: unknown) => {
            console.error('[pt-debug] screenshot failed:', error)
          })
        }, 3000)
      }
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.printtracker.app')

    const databasePath = join(app.getPath('userData'), 'print-tracker.db')

    ctx = createApp(databasePath, {
      filesChanged: scheduleFilesChanged,
      printRecorded: (event: PrintEvent) => broadcast(IPC.events.printRecorded, event),
      spoolerStatus: (status: SpoolerStatus) => broadcast(IPC.events.spoolerStatus, status),
      toast: (toast: ToastMessage) => broadcast(IPC.events.toast, toast)
    })

    registerIpc(ctx, () => mainWindow)

    // Snapshot every launch, before anything gets a chance to modify the data.
    ctx.backups.createOnLaunch()

    const settings = ctx.settings.get()
    if (settings.autoStartWatching) ctx.startWatching()
    if (settings.spoolerEnabled) ctx.spooler.start(settings.spoolerPollIntervalMs)

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    ctx?.dispose()
    ctx = null
  })
}
