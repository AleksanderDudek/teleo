import type { CharacterId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Character } from './Character'

interface AvatarProps {
  id: CharacterId
  /** Diameter in px. */
  size?: number
  selected?: boolean
  /** Hide the portrait from assistive tech when its name is written next to it. */
  decorative?: boolean
  className?: string
}

/** Round portrait in a gilded nimbus ring, cropped to head and shoulders. Named by the Character inside. */
export function Avatar({ id, size = 48, selected, decorative, className }: AvatarProps) {
  const width = size * 1.9
  return (
    <span
      className={cn(
        'relative inline-block shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_38%,#ecd08a,#c9962b_70%)] transition-shadow',
        selected
          ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--primary)]'
          : 'shadow-[0_0_0_1px_color-mix(in_oklab,var(--gold)_45%,transparent)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute" style={{ left: (size - width) / 2, top: -size * 0.12 }}>
        <Character id={id} pose="rest" halo={false} size={width} decorative={decorative} />
      </span>
      <span aria-hidden className="absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_#8a5e12,inset_0_0_0_4px_rgb(236_208_138/0.5)]" />
    </span>
  )
}
