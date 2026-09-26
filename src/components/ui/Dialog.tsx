import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Guardian, type GuardianMood } from '@/components/brand/Guardian'
import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  /** Prevent closing by Escape/backdrop (e.g. while an import is running). */
  locked?: boolean
  /** The Guardian above the title, in this mood (e.g. `rest` when pausing). */
  guide?: GuardianMood
  className?: string
}

/**
 * Modal built on the native <dialog>: focus trapping, Escape handling and the
 * inert background come from the platform.
 */
export function Dialog({ open, onClose, title, description, children, actions, locked, guide, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()
  const { t } = useTranslation()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // Backdrop click is a mouse convenience; keyboard users close with Escape (onCancel).
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!locked) onClose()
      }}
      onClick={(event) => {
        if (!locked && event.target === event.currentTarget) onClose()
      }}
      className={cn(
        'm-auto w-[min(34rem,calc(100vw-2rem))] rounded-3xl border border-line-strong bg-surface p-0 text-ink shadow-[var(--shadow-frame),0_25px_50px_-12px_rgb(0_0_0/0.25)] backdrop:bg-(--backdrop) backdrop:backdrop-blur-[2px] open:animate-rise',
        className,
      )}
    >
      <div className="p-6">
        {guide && <Guardian mood={guide} size={96} decorative className="mx-auto -mt-2 mb-1" />}
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-semibold">
            {title}
          </h2>
          {!locked && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="-mt-1 -mr-2 inline-flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-sunk hover:text-ink"
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
        {description && (
          <div id={descId} className="mt-2 text-ink-soft">
            {description}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </dialog>
  )
}
