import type { CSSProperties } from 'react'
import { GLYPHS, type GlyphName } from './glyphs'
import { PHOSPHOR, type PhosphorName } from './phosphor'

export type IconName = GlyphName | PhosphorName

/** Colour of the fill layer: gold leaf by default, the text colour for status/inactive icons. */
export type IconTone = 'gilded' | 'plain' | 'lapis' | 'cinnabar' | 'none'

const TONES: Record<IconTone, string> = {
  gilded: 'var(--icon-gild)',
  plain: 'currentColor',
  lapis: 'var(--lapis)',
  cinnabar: 'var(--cinnabar)',
  none: 'transparent',
}

interface IconProps {
  name: IconName
  /** Pixel size; without it the icon is 1em and a `size-*` class can set it. */
  size?: number
  tone?: IconTone
  /** Opacity of the fill layer (1 = solid gold leaf, e.g. the play triangle). */
  fillOpacity?: number
  /** Accessible name; icons are decorative (aria-hidden) without one. */
  label?: string
  className?: string
  style?: CSSProperties
}

function isGlyph(name: IconName): name is GlyphName {
  return Object.hasOwn(GLYPHS, name)
}

/**
 * Teleo icon: an ink outline (currentColor) over a gilded fill layer, like the gold under an icon
 * painter's line-work. Teleo Glyphs (devotional set, 24 grid, stroked) and Phosphor Duotone
 * (256 grid, filled outlines) render through the same two layers.
 */
export function Icon({ name, size, tone = 'gilded', fillOpacity, label, className, style }: IconProps) {
  const opacity = fillOpacity ?? (tone === 'plain' ? 0.18 : tone === 'none' ? 0 : 0.6)
  const glyph = isGlyph(name)
  const { fill, line } = glyph ? GLYPHS[name] : PHOSPHOR[name]
  return (
    <svg
      viewBox={glyph ? '0 0 24 24' : '0 0 256 256'}
      width={size ?? '1em'}
      height={size ?? '1em'}
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <g fill={TONES[tone]} fillOpacity={opacity}>
        {fill.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {glyph ? (
        <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          {line.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      ) : (
        <g fill="currentColor">
          {line.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
    </svg>
  )
}
