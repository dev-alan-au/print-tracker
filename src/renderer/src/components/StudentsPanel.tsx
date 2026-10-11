import { useCallback, useEffect, useState } from 'react'
import { STUDENT_NAME_MAX_LENGTH, type Student, type ToastMessage } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatDateTime } from '../lib/format'
import Modal from './Modal'
import PageHelp from './PageHelp'

/**
 * The class list. A name is the whole record, so the page is a list, a field and
 * two row actions.
 *
 * Removing a student is deliberately not a purge: prints keep the name they
 * were recorded under, so the history still adds up afterwards. That is what the
 * confirmation says, because "Delete" would otherwise read as "delete their
 * records too".
 */
export default function StudentsPanel({
  refreshToken,
  onChanged,
  onToast
}: {
  refreshToken: number
  onChanged: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t, tn, locale } = useI18n()
  const [students, setStudents] = useState<Student[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState<Student | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setStudents(await window.api.students.list())
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

  const add = async (): Promise<void> => {
    if (name.trim().length === 0) return
    setBusy(true)
    try {
      const created = await window.api.students.add(name.trim())
      setName('')
      await load()
      onChanged()
      onToast({
        kind: 'success',
        messageKey: 'students.toast.added',
        messageParams: { name: created.name }
      })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const confirmRename = async (): Promise<void> => {
    if (!renaming || renameValue.trim().length === 0) return
    setBusy(true)
    try {
      const updated = await window.api.students.rename(renaming.id, renameValue.trim())
      setRenaming(null)
      await load()
      onChanged()
      onToast({
        kind: 'success',
        messageKey: 'students.toast.renamed',
        messageParams: { name: updated.name }
      })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (student: Student): Promise<void> => {
    const confirmed = window.confirm(t('students.confirmRemove', { name: student.name }))
    if (!confirmed) return
    try {
      await window.api.students.remove(student.id)
      await load()
      onChanged()
      onToast({
        kind: 'info',
        messageKey: 'students.toast.removed',
        messageParams: { name: student.name }
      })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('students.title')}</h1>
          <p>{t('students.subtitle')}</p>
          <PageHelp page="students" />
        </div>
        <div className="row">
          <input
            className="search"
            type="text"
            placeholder={t('students.namePlaceholder')}
            value={name}
            maxLength={STUDENT_NAME_MAX_LENGTH}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add()
            }}
          />
          <button
            type="button"
            className="btn primary"
            disabled={busy || name.trim().length === 0}
            onClick={() => void add()}
          >
            {t('students.add')}
          </button>
        </div>
      </header>

      {error ? <div className="note">{error}</div> : null}

      <section className="panel">
        {!loaded ? (
          <div className="empty">{t('common.loading')}</div>
        ) : students.length === 0 ? (
          <div className="empty">
            <strong>{t('students.emptyTitle')}</strong>
            {t('students.emptyBody')}
          </div>
        ) : (
          <div className="panel-body flush">
            <table>
              <thead>
                <tr>
                  <th>{t('students.table.name')}</th>
                  <th>{t('students.table.since')}</th>
                  <th className="num">{t('students.table.prints')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td className="cell-sub">
                      {formatDateTime(student.createdAt, locale)}
                    </td>
                    <td className="num">
                      {student.printCount === 0
                        ? t('students.never')
                        : tn(student.printCount, 'unit.prints.one', 'unit.prints.other')}
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn tiny"
                          disabled={busy}
                          onClick={() => {
                            setRenaming(student)
                            setRenameValue(student.name)
                          }}
                        >
                          {t('students.rename')}
                        </button>
                        <button
                          type="button"
                          className="btn tiny danger"
                          disabled={busy}
                          onClick={() => void remove(student)}
                        >
                          {t('common.delete')}
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

      {renaming ? (
        <Modal
          title={t('students.rename')}
          onClose={() => setRenaming(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setRenaming(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy || renameValue.trim().length === 0}
                onClick={() => void confirmRename()}
              >
                {t('common.save')}
              </button>
            </>
          }
        >
          <input
            className="search"
            type="text"
            value={renameValue}
            maxLength={STUDENT_NAME_MAX_LENGTH}
            disabled={busy}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void confirmRename()
            }}
          />
        </Modal>
      ) : null}
    </>
  )
}
