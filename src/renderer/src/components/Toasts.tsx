import type { ToastMessage } from '@shared/types'

export interface Toast extends ToastMessage {
  id: number
}

export default function Toasts({
  toasts,
  onDismiss
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.kind}`}
          onClick={() => onDismiss(toast.id)}
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
