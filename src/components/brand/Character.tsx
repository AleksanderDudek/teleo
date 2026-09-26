import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CharacterId } from '@/domain/types'
import { Figure, type FigureProps, type Pose } from './Figure'

/* The Teleo congregation: four women and four men painted in the manner of an icon. */
const CAST: Record<CharacterId, Pick<FigureProps, 'gender' | 'skin' | 'hair' | 'hairStyle' | 'cloak' | 'veilStars'>> = {
  anna: { gender: 'female', skin: 1, hair: 'brown', hairStyle: 'long', cloak: 'lapis' },
  maria: { gender: 'female', skin: 0, hair: 'brown', hairStyle: 'veil', cloak: 'madder', veilStars: true },
  grace: { gender: 'female', skin: 4, hair: 'dark', hairStyle: 'bun', cloak: 'verdigris' },
  ewa: { gender: 'female', skin: 1, hair: 'grey', hairStyle: 'veil', cloak: 'ochre' },
  jan: { gender: 'male', skin: 1, hair: 'brown', hairStyle: 'short', cloak: 'cinnabar' },
  michal: { gender: 'male', skin: 2, hair: 'dark', hairStyle: 'beard', cloak: 'lapis' },
  david: { gender: 'male', skin: 4, hair: 'dark', hairStyle: 'curly', cloak: 'ochre' },
  piotr: { gender: 'male', skin: 0, hair: 'grey', hairStyle: 'beard', cloak: 'verdigris' },
}

interface CharacterProps {
  id: CharacterId
  pose?: Pose
  halo?: boolean
  size?: number
  /** Decorative when a visible name is already next to it. */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/** A user character from the cast, in any pose; eyes close in prayer. */
export function Character({ id, pose = 'praying', halo = true, size = 200, decorative, className, style }: CharacterProps) {
  const { t } = useTranslation()
  return (
    <Figure
      {...CAST[id]}
      pose={pose}
      eyes={pose === 'praying' ? 'closed' : 'open'}
      halo={halo}
      size={size}
      title={decorative ? undefined : t(`characters.${id}`)}
      className={className}
      style={style}
    />
  )
}
