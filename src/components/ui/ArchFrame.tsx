import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ArchFrameProps {
  /** `arch` for wide hero windows, `lancet` for narrow tiles. */
  shape?: 'arch' | 'lancet'
  /** A gold light-pool in the middle of the window. */
  glow?: boolean
  /** Optional image, inset 5px inside the gilded rule, never tinted. */
  src?: string
  alt?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * A stained-glass window: arched top and the gilded double rule of an icon panel. At most one per
 * screen, and never with body text in the curve.
 */
export function ArchFrame({ shape = 'arch', glow, src, alt = '', className, style, children }: ArchFrameProps) {
  const radius = shape === 'lancet' ? 'rounded-lancet' : 'rounded-arch'
  return (
    <div
      className={cn(
        'relative overflow-hidden border border-line-strong shadow-(--shadow-frame)',
        radius,
        glow ? 'bg-[radial-gradient(70%_80%_at_50%_45%,var(--gold-soft),var(--surface)_78%)]' : 'bg-surface',
        className,
      )}
      style={style}
    >
      {src && <img src={src} alt={alt} className={cn('absolute inset-[5px] size-[calc(100%-10px)] object-cover', radius)} />}
      <div className="relative h-full">{children}</div>
    </div>
  )
}
