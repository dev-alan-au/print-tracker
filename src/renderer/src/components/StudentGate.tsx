import { useEffect, useState } from 'react'
import { STUDENT_NAME_MAX_LENGTH, type Student } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'

/**
 * "Who is using the app?"
 *
 * Prints are attributed to whoever is chosen here, so the app will not run
 * without an answer. When nothing is selected this replaces the whole shell;
 * the same card is reused from the sidebar to switch, which is the only
 * difference between the two modes - a switcher can be dismissed, a launch
 * cannot.
 *
 * It creates students as well as picking them, because needing to go to another
 * screen to add the very first student would be a dead end.
 */
export default function StudentGate({
  students,
  onPick,
  onCancel
}: {
  students: Student[]
  onPick: (id: number) => void | Promise<void>
  onCancel?: () => void
}) {
  const { t, tn } = useI18n()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && onCancel) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const choose = async (id: number): Promise<void> => {
    setBusy(true)
    try {
      await onPick(id)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const create = async (): Promise<void> => {
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    setBusy(true)
    try {
      const created = await window.api.students.add(trimmed)
      setName('')
      setError(null)
      // Pick what was just made: adding a student to use the app is the only
      // reason to add one from here.
      await onPick(created.id)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const empty = students.length === 0

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (onCancel && event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="modal student-gate"
        role="dialog"
        aria-modal="true"
        aria-label={t('gate.title')}
      >
        <div className="modal-head">{t('gate.title')}</div>
        <div className="modal-body">
          <p className="gate-intro">{t('gate.intro')}</p>

          {empty ? null : (
            <div className="student-choices">
              {students.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className="student-choice"
                  disabled={busy}
                  onClick={() => void choose(student.id)}
                >
                  <span className="student-initial" aria-hidden="true">
                    {student.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="grow">{student.name}</span>
                  <span className="badge neutral">
                    {student.printCount === 0
                      ? t('students.never')
                      : tn(student.printCount, 'unit.prints.one', 'unit.prints.other')}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="gate-add">
            <label htmlFor="gate-new-student">
              {empty ? t('gate.createFirst') : t('students.add')}
            </label>
            <div className="row">
              <input
                id="gate-new-student"
                className="search"
                type="text"
                placeholder={t('students.namePlaceholder')}
                value={name}
                maxLength={STUDENT_NAME_MAX_LENGTH}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void create()
                }}
              />
              <button
                type="button"
                className="btn primary"
                disabled={busy || name.trim().length === 0}
                onClick={() => void create()}
              >
                {empty ? t('gate.add') : t('students.add')}
              </button>
            </div>
          </div>

          {error ? <div className="note">{error}</div> : null}
        </div>
        {onCancel ? (
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onCancel}>
              {t('gate.cancel')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
