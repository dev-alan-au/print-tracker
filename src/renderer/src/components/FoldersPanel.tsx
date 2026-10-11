import { useCallback, useEffect, useState } from 'react'
import type { FolderKind, ToastMessage, TrackedFolder } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import Modal from './Modal'
import PageHelp from './PageHelp'

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
  const { t } = useI18n()
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
    const confirmed = window.confirm(t('folders.confirmRemove', { name: folder.name }))
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
      onToast({
        kind: 'success',
        messageKey: 'folders.toast.rescanned',
        messageParams: { name: folder.name, count: result.indexed }
      })
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
      onToast({
        kind: 'success',
        messageKey: 'folders.toast.rescannedAll',
        messageParams: { folders: folders.length, files: total }
      })
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
          <h1>{t('folders.title')}</h1>
          <p>{t('folders.subtitle')}</p>
          <PageHelp page="folders" />
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={busy || folders.length === 0} onClick={() => void rescanAll()}>
            {t('folders.rescanAll')}
          </button>
          <button type="button" className="btn primary" onClick={() => void pickFolder()}>
            {t('folders.add')}
          </button>
        </div>
      </header>

      {error ? <div className="note">{error}</div> : null}

      <section className="panel">
        {!loaded ? (
          <div className="empty">{t('folders.loading')}</div>
        ) : folders.length === 0 ? (
          <div className="empty">
            <strong>{t('folders.emptyTitle')}</strong>
            {t('folders.emptyBody')}
          </div>
        ) : (
          <div className="panel-body flush">
            <table>
              <thead>
                <tr>
                  <th>{t('folders.table.folder')}</th>
                  <th>{t('folders.table.role')}</th>
                  <th>{t('folders.table.subfolders')}</th>
                  <th>{t('folders.table.enabled')}</th>
                  <th className="num">{t('folders.table.files')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr key={folder.id}>
                    <td>
                      <div className="cell-main">
                        {folder.name}{' '}
                        {folder.kind === 'output' ? (
                          <span className="badge output">{t('folders.badge.output')}</span>
                        ) : null}
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
                        <option value="library">{t('folders.role.library')}</option>
                        <option value="output">{t('folders.role.output')}</option>
                      </select>
                    </td>
                    <td>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={folder.recursive}
                          onChange={(event) => void update(folder.id, { recursive: event.target.checked })}
                        />
                        {t('folders.recursive')}
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
                          {t('common.rescan')}
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => reveal(folder)}
                        >
                          {t('common.open')}
                        </button>
                        <button
                          type="button"
                          className="btn tiny danger"
                          onClick={() => void remove(folder)}
                        >
                          {t('common.remove')}
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
          title={t('folders.modal.title')}
          onClose={() => setPending(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn primary" disabled={busy} onClick={() => void confirmAdd()}>
                {busy ? t('folders.modal.submitting') : t('folders.modal.submit')}
              </button>
            </>
          }
        >
          <div className="field">
            <label>{t('folders.modal.folder')}</label>
            <code>{pending.path}</code>
          </div>

          <div className="field">
            <label htmlFor="folder-kind">{t('folders.modal.role')}</label>
            <select
              id="folder-kind"
              value={pending.kind}
              onChange={(event) =>
                setPending({ ...pending, kind: event.target.value as FolderKind })
              }
            >
              <option value="library">{t('folders.role.libraryLong')}</option>
              <option value="output">{t('folders.role.outputLong')}</option>
            </select>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={pending.recursive}
              onChange={(event) => setPending({ ...pending, recursive: event.target.checked })}
            />
            {t('folders.modal.includeSubfolders')}
          </label>

          <div className="note">{t('folders.modal.note')}</div>
        </Modal>
      ) : null}
    </>
  )
}
