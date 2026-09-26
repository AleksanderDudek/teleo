import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { IconHalo } from '@/components/ui/IconHalo'
import { cn } from '@/lib/cn'
import { useUiStore, type Toast } from '@/stores/ui'

const HALOS = {
  info: { icon: 'info', tone: 'gold', color: 'text-gold-ink' },
  success: { icon: 'check-circle', tone: 'sunk', color: 'text-ok' },
  error: { icon: 'warning', tone: 'cinnabar', color: 'text-bad' },
} as const

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUiStore((s) => s.dismissToast)
  const { t } = useTranslation()
  const halo = HALOS[toast.kind]

  useEffect(() => {
    if (toast.timeoutMs === null) return
    const timer = window.setTimeout(() => dismiss(toast.id), toast.timeoutMs)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.timeoutMs, dismiss])

  return (
    <li
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-surface p-4 shadow-xl animate-rise',
        toast.kind === 'error' ? 'border-bad/40' : 'border-line',
      )}
    >
      <IconHalo
        icon={halo.icon}
        tone={halo.tone}
        size={32}
        iconSize={18}
        iconTone={toast.kind === 'info' ? 'gilded' : 'plain'}
        className={cn('-mt-0.5', halo.color)}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-sm text-ink-soft">{toast.body}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.run()
              dismiss(toast.id)
            }}
            className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={t('common.close')}
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-sunk"
      >
        <Icon name="x" size={16} />
      </button>
    </li>
  )
}

/** Toast stack; polite live region so screen readers announce new messages. */
export function Toasts() {
  const toasts = useUiStore((s) => s.toasts)
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex w-full max-w-md flex-col gap-2 p-4 pt-[max(env(safe-area-inset-top),1rem)]"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </ol>
  )
}
