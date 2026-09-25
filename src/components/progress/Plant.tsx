import { useId } from 'react'
import { GROUND_Y, plantScene, type PlantPart } from './plantScene'

function leafPath(size: number): string {
  // Almond leaf pointing right from the origin, midrib along the x axis.
  return `M0 0 C ${size * 0.35} ${-size * 0.42}, ${size * 0.8} ${-size * 0.36}, ${size} 0 C ${size * 0.8} ${size * 0.36}, ${size * 0.35} ${size * 0.42}, 0 0 Z`
}

function Part({ part, index, clip }: { part: PlantPart; index: number; clip: string }) {
  const style = { animationDelay: `${Math.min(index, 24) * 45}ms`, transformBox: 'fill-box', transformOrigin: 'center' } as const
  switch (part.kind) {
    case 'stem':
      return <path d={part.d} fill="none" stroke="var(--leaf)" strokeWidth={part.width} strokeLinecap="round" />
    case 'leaf':
      return (
        <g transform={`translate(${part.x} ${part.y}) rotate(${part.angle})`}>
          <path d={leafPath(part.size)} fill="var(--leaf)" fillOpacity="0.88" stroke="var(--leaf)" strokeWidth="0.8" className="animate-unfurl" style={style} />
          <path d={`M1 0 L${part.size * 0.85} 0`} stroke="var(--surface)" strokeOpacity="0.55" strokeWidth="0.7" />
        </g>
      )
    case 'bud':
      return <ellipse cx={part.x} cy={part.y} rx={part.size * 0.6} ry={part.size} fill="var(--gold-soft)" stroke="var(--leaf)" strokeWidth="1.2" className="animate-unfurl" style={style} />
    case 'flower':
      return (
        <g className="animate-unfurl" style={style}>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2
            return <circle key={i} cx={part.x + Math.cos(a) * part.size * 0.55} cy={part.y + Math.sin(a) * part.size * 0.55} r={part.size * 0.48} fill="var(--gold)" fillOpacity="0.9" />
          })}
          <circle cx={part.x} cy={part.y} r={part.size * 0.3} fill="var(--gold-ink)" />
        </g>
      )
    case 'fruit':
      return <circle cx={part.x} cy={part.y} r={part.size} fill="var(--bad)" fillOpacity="0.78" stroke="var(--surface)" strokeWidth="1" className="animate-unfurl" style={style} />
    case 'seed':
      return <ellipse cx={part.x} cy={part.y} rx="7" ry="4.6" fill="var(--gold)" stroke="var(--gold-ink)" strokeWidth="1" transform={`rotate(-18 ${part.x} ${part.y})`} />
    case 'crown':
      return (
        <g className="animate-unfurl" style={style}>
          <ellipse cx={part.x} cy={part.y} rx={part.rx} ry={part.ry} fill="var(--leaf)" fillOpacity="0.9" />
          <circle cx={part.x - part.rx * 0.45} cy={part.y - part.ry * 0.2} r={part.rx * 0.55} fill="var(--leaf)" />
          <circle cx={part.x + part.rx * 0.4} cy={part.y - part.ry * 0.3} r={part.rx * 0.5} fill="var(--leaf)" fillOpacity="0.95" />
          <circle cx={part.x - part.rx * 0.2} cy={part.y - part.ry * 0.45} r={part.rx * 0.3} fill="var(--surface)" fillOpacity="0.14" />
        </g>
      )
    case 'trunk':
      return (
        <path
          d={`M${part.x - part.width} ${GROUND_Y} Q ${part.x - part.width * 0.4} ${(GROUND_Y + part.top) / 2} ${part.x - part.width * 0.35} ${part.top} L ${part.x + part.width * 0.35} ${part.top} Q ${part.x + part.width * 0.4} ${(GROUND_Y + part.top) / 2} ${part.x + part.width} ${GROUND_Y} Z`}
          fill="var(--ink-soft)"
        />
      )
    case 'roots':
      return (
        <g clipPath={`url(#${clip})`} stroke="var(--ink-faint)" strokeWidth="1.4" fill="none" strokeLinecap="round">
          {[-1, -0.5, 0, 0.5, 1].map((k) => (
            <path key={k} d={`M${part.x} ${GROUND_Y} C ${part.x + k * part.spread * 0.3} ${GROUND_Y + part.depth * 0.4}, ${part.x + k * part.spread * 0.8} ${GROUND_Y + part.depth * 0.6}, ${part.x + k * part.spread} ${GROUND_Y + part.depth}`} />
          ))}
        </g>
      )
    case 'sun':
      return (
        <g className="animate-fade" style={style}>
          {Array.from({ length: part.rays }, (_, i) => {
            const a = (i / part.rays) * Math.PI * 2
            return (
              <line key={i} x1={part.x + Math.cos(a) * (part.r + 4)} y1={part.y + Math.sin(a) * (part.r + 4)} x2={part.x + Math.cos(a) * (part.r + 11)} y2={part.y + Math.sin(a) * (part.r + 11)} stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" />
            )
          })}
          <circle cx={part.x} cy={part.y} r={part.r} fill="var(--gold)" fillOpacity="0.85" />
        </g>
      )
    case 'path':
      return <path d={part.d} fill="none" stroke="var(--line-strong)" strokeWidth="6" strokeLinecap="round" />
  }
}

/** The garden that grows with the user's level (spec §9.3). Decorative: the level is stated in text nearby. */
export function Plant({ level, className }: { level: number; className?: string }) {
  const scene = plantScene(level)
  const clip = useId().replace(/:/g, '')
  const order: PlantPart['kind'][] = ['sun', 'path', 'roots', 'trunk', 'stem', 'crown', 'leaf', 'bud', 'flower', 'fruit', 'seed']
  const parts = [...scene.parts].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  // Young plants are small in the 240×200 scene: zoom in around the ground, keeping it in view.
  const zoom = scene.stage <= 2 ? 2.4 : scene.stage <= 5 ? 1.8 : scene.stage <= 9 ? 1.3 : 1
  const vw = 240 / zoom
  const vh = 200 / zoom
  const viewBox = `${120 - vw / 2} ${200 - vh} ${vw} ${vh}`
  return (
    <svg viewBox={viewBox} aria-hidden className={className}>
      <defs>
        <clipPath id={clip}>
          <rect x="0" y={GROUND_Y} width="240" height={200 - GROUND_Y} />
        </clipPath>
        <radialGradient id={`${clip}-glow`} cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="var(--gold-soft)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--gold-soft)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="120" rx="118" ry="86" fill={`url(#${clip}-glow)`} />
      {Array.from({ length: Math.min(scene.rings, 5) }, (_, i) => (
        <circle key={i} cx="120" cy="104" r={92 - i * 7} fill="none" stroke="var(--gold)" strokeOpacity={0.55 - i * 0.07} strokeWidth="1.2" />
      ))}
      <rect x="0" y={GROUND_Y} width="240" height={200 - GROUND_Y} fill="var(--surface-sunk)" />
      <path d={`M0 ${GROUND_Y} Q 60 ${GROUND_Y - 3} 120 ${GROUND_Y} T 240 ${GROUND_Y}`} fill="none" stroke="var(--line-strong)" strokeWidth="1.4" />
      {parts.map((part, i) => (
        <Part key={i} part={part} index={i} clip={clip} />
      ))}
    </svg>
  )
}
