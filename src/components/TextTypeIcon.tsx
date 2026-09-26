import { Icon, type IconName, type IconTone } from '@/components/icons/Icon'
import type { TextType } from '@/domain/types'

const ICONS: Record<TextType, IconName> = { prayer: 'praying-hands', affirmation: 'radiant-heart', text: 'scroll-ribbon' }

/** Prayer → praying hands, affirmation → radiant heart, text → scroll (gilded duotone). */
export function TextTypeIcon({ type, size, tone, className }: { type: TextType; size?: number; tone?: IconTone; className?: string }) {
  return <Icon name={ICONS[type]} size={size} tone={tone} className={className} />
}
