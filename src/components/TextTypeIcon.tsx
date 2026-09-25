import { HandHeart, ScrollText, Sunrise } from 'lucide-react'
import type { TextType } from '@/domain/types'

const ICONS = { prayer: HandHeart, affirmation: Sunrise, text: ScrollText } as const

export function TextTypeIcon({ type, className }: { type: TextType; className?: string }) {
  const Icon = ICONS[type]
  return <Icon aria-hidden className={className} strokeWidth={1.6} />
}
