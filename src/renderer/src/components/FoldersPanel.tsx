import { useCallback, useEffect, useState } from 'react'
import type { FolderKind, ToastMessage, TrackedFolder } from '@shared/types'
import { errorMessage } from '../lib/format'
import Modal from './Modal'

interface PendingFolder {
  path: string
  kind: FolderKind
  recursive: boolean
}

export default function FoldersPanel({
  refreshToken,
  onChanged,
  onToast
}: {
  refreshToken: number
  onChanged: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const [folders, setFolders] = useState<TrackedFolder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingFolder | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setFolders(await window.api.folders.list())
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const pickFolder = async (): Promise<void> => {
    try {
      const picked = await window.api.folders.pickDirectory()
      if (picked) setPending({ path: picked, kind: 'library', recursive: true })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const confirmAdd = async (): Promise<void> => {
    if (!pending) return
    setBusy(true)
    try {
      await window.api.folders.add(pending)
      setPending(null)
      await load()
      onChanged()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const update = async (
    id: number,
    patch: { kind?: FolderKind; recursive?: boolean; enabled?: boolean }
  ): Promise<void> => {
    try {
      await window.api.folders.update({ id, ...patch })
      await load()
      onChanged()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const remove = async (folder: TrackedFolder): Promise<void> => {
    const confirmed = window.confirm(
      `Stop tracking "${folder.name}"?\n\nIts indexed files are removed from the database. Recorded print history is kept.`
    )
    if (!confirmed) return
    try {
      await window.api.folders.remove(folder.id)
      await load()
      onChanged()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const reveal = (folder: TrackedFolder): void => {
    void window.api.folders.reveal(folder.id).catch((caught: unknown) => {
      setError(errorMessage(caught))
    })
  }

  const rescan = async (folder: TrackedFolder): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.api.folders.rescan(folder.id)
      onToast({ kind: 'success', message: `Rescanned "${folder.name}" — ${result.indexed} file(s).` })
      await load()
      onChanged()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const rescanAll = async (): Promise<void> => {
    setBusy(true)
    try {
      let total = 0
      for (const folder of folders) {
        const result = await window.api.folders.rescan(folder.id)
        total += result.indexed
      }
      onToast({ kind: 'success', message: `Rescanned ${folders.length} folder(s) — ${total} file(s).` })
      await load()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Folders</h1>
          <p>
            <strong>Library</strong> folders are indexed and tracked. <strong>Output</strong> folders
            additionally record a print every time a new file lands in them.
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={busy || folders.length === 0} onClick={() => void rescanAll()}>
            Rescan all
          </button>
          <button type="button" className="btn primary" onClick={() => void pickFolder()}>
            + Add folder
          </button>
        </div>
      </header>

      {error ? <div className="note">{error}</div> : null}

      <section className="panel">
        {!loaded ? (
          <div className="empty">Loading folders…</div>
        ) : folders.length === 0 ? (
          <div className="empty">
            <strong>No folders tracked yet</strong>
            Add a folder of documents, or an output folder that your print workflow drops files into.
          </div>
        ) : (
          <div className="panel-body flush">
            <table>
              <thead>
                <tr>
                  <th>Folder</th>
                  <th>Role</th>
                  <th>Subfolders</th>
                  <th>Enabled</th>
                  <th className="num">Files</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr key={folder.id}>
                    <td>
                      <div className="cell-main">
                        {folder.name}{' '}
                        {folder.kind === 'output' ? <span className="badge output">output</span> : null}
                      </div>
                      <div className="cell-sub">{folder.path}</div>
                    </td>
                    <td>
                      <select
                        value={folder.kind}
                        onChange={(event) =>
                          void update(folder.id, { kind: event.target.value as FolderKind })
                        }
                      >
                        <option value="library">Library</option>
                        <option value="output">Output / spool</option>
                      </select>
                    </td>
                    <td>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={folder.recursive}
                          onChange={(event) => void update(folder.id, { recursive: event.target.checked })}
                        />
                        recursive
                      </label>
                    </td>
                    <td>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={folder.enabled}
                          onChange={(event) => void update(folder.id, { enabled: event.target.checked })}
                        />
                      </label>
                    </td>
                    <td className="num">{folder.fileCount}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn tiny"
                          disabled={busy}
                          onClick={() => void rescan(folder)}
                        >
                          Rescan
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => reveal(folder)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn tiny danger"
                          onClick={() => void remove(folder)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pending ? (
        <Modal
          title="Track a folder"
          onClose={() => setPending(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="btn primary" disabled={busy} onClick={() => void confirmAdd()}>
                {busy ? 'Indexing…' : 'Add folder'}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Folder</label>
            <code>{pending.path}</code>
          </div>

          <div className="field">
            <label htmlFor="folder-kind">Role</label>
            <select
              id="folder-kind"
              value={pending.kind}
              onChange={(event) =>
                setPending({ ...pending, kind: event.target.value as FolderKind })
              }
            >
              <option value="library">Library — index files, no automatic print events</option>
              <option value="output">Output / spool — new files count as prints</option>
            </select>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={pending.recursive}
              onChange={(event) => setPending({ ...pending, recursive: event.target.checked })}
            />
            Include subfolders
          </label>

          <div className="note">
            Files are <strong>not copied</strong>. Print Tracker only stores the path, size and
            timestamps in a local database.
          </div>
        </Modal>
      ) : null}
    </>
  )
}
