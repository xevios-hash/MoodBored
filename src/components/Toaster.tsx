import { useSyncExternalStore } from 'react'
import { subscribeToasts, getToasts, dismissToast, type Toast } from '@/lib/toasts'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t: Toast) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg shadow-panel glass-card text-sm animate-fadeIn ${
            t.kind === 'error' ? 'text-danger' : 'text-text-primary'
          }`}
        >
          {t.kind === 'error' ? <AlertCircle size={16} className="text-danger" /> :
           t.kind === 'success' ? <CheckCircle2 size={16} className="text-accent" /> :
           <Info size={16} className="text-accent" />}
          <span className="max-w-[70vw]">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="text-text-muted hover:text-text-primary"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
