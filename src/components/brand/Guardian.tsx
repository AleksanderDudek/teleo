import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Figure, type FigureProps } from './Figure'

/**
 * welcome — greetings, Today · teach — rules and tips · listen — while the mic is live ·
 * celebrate — goal met, summary · encourage — after a failed attempt · point — directs attention ·
 * rest — empty states, pause.
 */
export type GuardianMood = 'welcome' | 'teach' | 'listen' | 'celebrate' | 'encourage' | 'point' | 'rest'

const MOODS: Record<GuardianMood, Pick<FigureProps, 'pose' | 'eyes' | 'smile' | 'raisedWings'>> = {
  welcome: { pose: 'blessing', smile: true },
  teach: { pose: 'scroll' },
  listen: { pose: 'praying', eyes: 'closed' },
  celebrate: { pose: 'orans', smile: true, raisedWings: true },
  encourage: { pose: 'heart', smile: true },
  point: { pose: 'point' },
  rest: { pose: 'rest', eyes: 'closed' },
}

interface GuardianProps {
  mood?: GuardianMood
  size?: number
  /** Decorative when the Guardian is already named nearby (e.g. in a GuideBubble). */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/** The Guardian — Teleo's guiding angel (PL "Anioł Stróż"): radiating nimbus, cinnabar cloak, stained-glass wings. */
export function Guardian({ mood = 'welcome', size = 200, decorative, className, style }: GuardianProps) {
  const { t } = useTranslation()
  return (
    <Figure
      kind="angel"
      skin={1}
      hair="blonde"
      hairStyle="curls"
      cloak="cinnabar"
      wings="lapis"
      rays
      {...MOODS[mood]}
      size={size}
      title={decorative ? undefined : t('guardian.name')}
      className={className}
      style={style}
    />
  )
}
