import type { CSSProperties } from 'react'

/*
 * Teleo figures: half-length portraits in the manner of a painted icon — flat pigment, umber
 * line-work, almond eyes, long nose, gold nimbus, a cloak over a tunic with a gold hem and clavus.
 * Pigments are fixed (not themed), like a painting, so a figure looks the same in light and dark.
 */
const P = {
  umber: '#231a14',
  line: '#4a3222',
  gold: '#c9962b',
  goldDeep: '#8a5e12',
  goldPale: '#ecd08a',
  ivory: '#f3e9d2',
  ivoryShade: '#e2d3b2',
  lapis: '#1f3b8c',
  azure: '#3c6e9e',
  cinnabar: '#b53a24',
  madder: '#6e1a1a',
  verdigris: '#3c6b4a',
  ochre: '#b07a2a',
  eyeWhite: '#fbf3e4',
  lips: '#a8452f',
} as const

const SKIN = ['#f2d6ba', '#e3b891', '#c68f63', '#8e5b3a', '#5c3a25'] as const
const HAIR = { dark: '#2a1c14', brown: '#5a3a22', auburn: '#8a3e1e', blonde: '#c79a4e', grey: '#a59c90', white: '#e6e0d4' } as const
const CLOAK = { lapis: P.lapis, cinnabar: P.cinnabar, verdigris: P.verdigris, madder: P.madder, ochre: P.ochre, azure: P.azure } as const
const WINGS = {
  lapis: ['#1f3b8c', '#3c6e9e', '#3c6b4a'],
  cinnabar: ['#8e1f1a', '#b53a24', '#d9973a'],
  gold: ['#8a5e12', '#c9962b', '#ecd08a'],
} as const

export type Skin = 0 | 1 | 2 | 3 | 4
export type Hair = keyof typeof HAIR
export type Cloak = keyof typeof CLOAK
export type WingColors = keyof typeof WINGS
export type HairStyle = 'long' | 'bun' | 'veil' | 'short' | 'beard' | 'curly' | 'curls'
export type Pose = 'praying' | 'blessing' | 'book' | 'scroll' | 'orans' | 'heart' | 'point' | 'rest'

type Point = readonly [number, number]
/** Shoulder → hand position and hand rotation. */
type Arm = readonly [from: Point, hand: Point, rotation: number] | null

const ARMS: Record<Pose, readonly [Arm, Arm]> = {
  praying: [
    [[70, 140], [95, 150], 12],
    [[130, 140], [105, 150], -12],
  ],
  blessing: [[[66, 138], [58, 118], -8], null],
  book: [
    [[70, 142], [80, 170], 60],
    [[130, 142], [120, 170], -60],
  ],
  scroll: [
    [[68, 142], [64, 168], 40],
    [[132, 142], [136, 168], -40],
  ],
  orans: [
    [[62, 136], [36, 112], -24],
    [[138, 136], [164, 112], 24],
  ],
  heart: [[[70, 140], [88, 152], 70], null],
  point: [[[134, 138], [176, 138], 72], null],
  rest: [null, null],
}

function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)))
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/** Eight-point star path (veil stars, the angel's jewel). */
function star(cx: number, cy: number, radius: number): string {
  let d = ''
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8
    const r = i % 2 ? radius * 0.42 : radius
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`
  }
  return `${d}Z`
}

function Hand({ x, y, rotation, skin }: { x: number; y: number; rotation: number; skin: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
      <path d="M-6.5 9h13v5h-13Z" fill={P.gold} stroke={P.line} strokeWidth="1" />
      <path d="M-5.5 2C-5.5 -8 -3.5 -13 0 -13S5.5 -8 5.5 2C5.5 7 3 9.5 0 9.5S-5.5 7 -5.5 2Z" fill={skin} stroke={P.line} strokeWidth="1.2" />
      <path d="M-5.3 3C-9.5 0 -10.5 -4 -8.6 -5.4C-6.8 -6 -5.6 -2.8 -4.6 -1.4" fill={skin} stroke={P.line} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M-1.8 -10V-3M1.8 -10V-3" stroke={P.line} strokeWidth=".7" strokeOpacity=".55" strokeLinecap="round" />
    </g>
  )
}

function Sleeve({ from, to, color }: { from: Point; to: Point; color: string }) {
  const d = `M${from[0]} ${from[1]} Q${(from[0] + to[0]) / 2} ${Math.max(from[1], to[1]) + 14} ${to[0]} ${to[1]}`
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={P.line} strokeWidth="21" />
      <path d={d} stroke={color} strokeWidth="18" />
      <path d={d} stroke={P.umber} strokeOpacity=".18" strokeWidth="1.2" transform="translate(0 4)" />
    </g>
  )
}

/** Stained-glass wing: three layered feathers of lapis, azure and verdigris (or cinnabar / gold). */
function Wing({ colors, raised, flip }: { colors: readonly string[]; raised: boolean; flip?: boolean }) {
  const d = 'M86 124C60 100 30 70 18 22C40 44 58 56 76 62C52 64 34 78 22 110C44 100 60 102 74 108C54 120 40 150 34 196C56 172 72 156 84 144Z'
  const transform = `${flip ? 'translate(200 0) scale(-1 1) ' : ''}${raised ? 'rotate(-14 86 124) ' : ''}translate(86 124) scale(1.22) translate(-88 -124)`
  return (
    <g transform={transform}>
      {[1, 0.8, 0.6].map((s, i) => (
        <path key={s} d={d} transform={`translate(86 124) scale(${s}) translate(-86 -124)`} fill={colors[i]} stroke={P.line} strokeWidth={1.4 / s} strokeLinejoin="round" />
      ))}
      <path d="M76 62L58 76M74 108L52 116M84 144L60 170M70 84L46 92" stroke={P.goldPale} strokeOpacity=".55" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  )
}

export interface FigureProps {
  kind?: 'person' | 'angel'
  gender?: 'female' | 'male'
  skin?: Skin
  hair?: Hair
  hairStyle?: HairStyle
  cloak?: Cloak
  pose?: Pose
  eyes?: 'open' | 'closed'
  smile?: boolean
  halo?: boolean
  /** Radiating nimbus rays (the Guardian). */
  rays?: boolean
  wings?: WingColors
  raisedWings?: boolean
  veilStars?: boolean
  /** Width in px; the figure is 10% taller than wide. */
  size?: number
  /** Accessible name; decorative (aria-hidden) without one. */
  title?: string
  className?: string
  style?: CSSProperties
}

/** Low-level parametric icon-style figure (person or angel). Prefer the Character / Guardian presets. */
export function Figure({
  kind = 'person',
  gender = 'female',
  skin = 1,
  hair = 'brown',
  hairStyle,
  cloak = 'lapis',
  pose = 'praying',
  eyes = 'open',
  smile = false,
  halo = true,
  rays = false,
  wings = 'lapis',
  raisedWings = false,
  veilStars = false,
  size = 200,
  title,
  className,
  style,
}: FigureProps) {
  const S = SKIN[skin]
  const H = HAIR[hair]
  const C = CLOAK[cloak]
  const angel = kind === 'angel'
  const hs: HairStyle = hairStyle ?? (angel ? 'curls' : gender === 'female' ? 'long' : 'short')
  const L = P.line
  const arms = ARMS[pose]
  const bearded = gender === 'male' && !angel && (hs === 'beard' || hair === 'grey' || hair === 'white')
  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size * 1.1}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {angel && (
        <>
          <Wing colors={WINGS[wings]} raised={raisedWings} />
          <Wing colors={WINGS[wings]} raised={raisedWings} flip />
        </>
      )}
      {halo && (
        <g>
          {rays &&
            Array.from({ length: 24 }, (_, i) => {
              const a = (i / 24) * Math.PI * 2
              const outer = i % 2 ? 60 : 68
              return (
                <line key={i} x1={100 + Math.cos(a) * 52} y1={70 + Math.sin(a) * 52} x2={100 + Math.cos(a) * outer} y2={70 + Math.sin(a) * outer} stroke={P.gold} strokeWidth="2" strokeLinecap="round" />
              )
            })}
          <circle cx="100" cy="70" r="47" fill={P.gold} stroke={P.goldDeep} strokeWidth="2" />
          <circle cx="100" cy="70" r="41" fill="none" stroke={P.goldDeep} strokeOpacity=".5" strokeWidth="1" />
          <circle cx="100" cy="70" r="47" fill="none" stroke={P.goldPale} strokeOpacity=".6" strokeWidth="1" strokeDasharray="1 5" />
        </g>
      )}
      {hs === 'veil' && <path d="M70 80C66 40 80 28 100 28C120 28 134 40 130 80L152 150C132 140 118 130 114 118H86C82 130 68 140 48 150Z" fill={C} stroke={L} strokeWidth="1.4" />}
      {(hs === 'long' || hs === 'bun') && (
        <path
          d={hs === 'long' ? 'M76 70C72 40 88 36 100 36C112 36 128 40 124 70L130 128C118 124 112 118 110 108H90C88 118 82 124 70 128Z' : 'M78 70C76 44 88 38 100 38C112 38 124 44 122 70Z'}
          fill={H}
          stroke={L}
          strokeWidth="1.2"
        />
      )}
      {hs === 'bun' && <circle cx="100" cy="38" r="12" fill={H} stroke={L} strokeWidth="1.2" />}
      {/* body: ivory tunic with a gold clavus, cloak falling from both shoulders */}
      <path d="M42 220C44 160 58 124 100 118C142 124 156 160 158 220Z" fill={P.ivory} stroke={L} strokeWidth="1.4" />
      <path d="M111 128H117L119 220H112Z" fill={P.gold} opacity=".9" />
      <path d="M42 220C44 164 56 128 84 118L94 124C80 150 76 186 80 220Z" fill={C} stroke={L} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M158 220C156 164 144 128 116 118L108 124C124 146 130 184 128 220Z" fill={C} stroke={L} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M94 124C80 150 76 186 80 220M108 124C124 146 130 184 128 220" fill="none" stroke={P.gold} strokeWidth="2.6" />
      <path d="M60 168Q66 192 63 220M141 168Q135 192 138 220M70 140Q76 150 74 164M130 140Q124 150 126 164" fill="none" stroke={shade(C, 0.6)} strokeWidth="1.6" strokeLinecap="round" />
      {/* neck and head */}
      <path d="M90 94H110L111 120Q100 127 89 120Z" fill={shade(S, 0.9)} stroke={L} strokeWidth="1.2" />
      <path d="M86 119Q100 129 114 119" fill="none" stroke={P.gold} strokeWidth="2.6" />
      <ellipse cx="100" cy="72" rx="21" ry="26" fill={S} stroke={L} strokeWidth="1.4" />
      <ellipse cx="88" cy="81" rx="5" ry="3" fill={P.cinnabar} opacity=".13" />
      <ellipse cx="112" cy="81" rx="5" ry="3" fill={P.cinnabar} opacity=".13" />
      {/* face: brows flowing into a long nose, almond eyes */}
      <path d="M84 64Q90.5 59.5 97 63.5M103 63.5Q109.5 59.5 116 64" fill="none" stroke={P.umber} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M99 64L97.4 82Q100 84.6 103 82.4" fill="none" stroke={L} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      {eyes === 'closed' ? (
        <path d="M86 71Q91 74 96 71M104 71Q109 74 114 71" fill="none" stroke={P.umber} strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <g>
          <path d="M85.5 70.5Q91 66 96.5 70.5Q91 74 85.5 70.5Z" fill={P.eyeWhite} stroke={P.umber} strokeWidth="1.1" />
          <path d="M103.5 70.5Q109 66 114.5 70.5Q109 74 103.5 70.5Z" fill={P.eyeWhite} stroke={P.umber} strokeWidth="1.1" />
          <circle cx="91.5" cy="70.3" r="2.3" fill={P.umber} />
          <circle cx="108.5" cy="70.3" r="2.3" fill={P.umber} />
        </g>
      )}
      <path d={smile ? 'M94.5 89.5Q100 93.5 105.5 89.5' : 'M95 90Q100 91.8 105 90'} fill="none" stroke={P.lips} strokeWidth="2" strokeLinecap="round" />
      {/* hair or veil, front */}
      {hs === 'veil' && (
        <>
          <path d="M80 74C80 54 88 46 100 46C112 46 120 54 120 74C114 60 108 56 100 56C92 56 86 60 80 74Z" fill={P.azure} stroke={L} strokeWidth="1" />
          <path d="M77 88C74 54 84 42 100 42C116 42 126 54 123 88" fill="none" stroke={P.gold} strokeWidth="3" strokeLinecap="round" />
          <path d="M76 90C73 54 83 38 100 38C117 38 127 54 124 90" fill="none" stroke={L} strokeWidth="1" />
          {veilStars && (
            <>
              <path d={star(100, 34, 5)} fill={P.gold} />
              <path d={star(68, 140, 5)} fill={P.gold} />
              <path d={star(132, 140, 5)} fill={P.gold} />
            </>
          )}
        </>
      )}
      {(hs === 'long' || hs === 'bun') && (
        <>
          <path d="M79 74C78 52 88 44 100 44C112 44 122 52 121 74C117 60 109 54 100 56C91 54 83 60 79 74Z" fill={H} stroke={L} strokeWidth="1.2" />
          <path d="M100 45Q98 52 100 56" fill="none" stroke={shade(H, 0.6)} strokeWidth="1" />
        </>
      )}
      {hs === 'short' && <path d="M78 76C74 50 84 40 100 40C116 40 126 50 122 76C119 62 112 54 100 54C88 54 81 62 78 76Z" fill={H} stroke={L} strokeWidth="1.2" />}
      {(hs === 'curly' || hs === 'curls') && (
        <g fill={H} stroke={L} strokeWidth="1.1">
          {[
            [80, 66, 7],
            [82, 54, 8],
            [91, 45, 8],
            [100, 42, 8],
            [109, 45, 8],
            [118, 54, 8],
            [120, 66, 7],
            ...(hs === 'curls'
              ? [
                  [77, 78, 6],
                  [123, 78, 6],
                ]
              : []),
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      )}
      {angel && (
        <>
          <path d="M80 58Q100 49 120 58" fill="none" stroke={P.gold} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M80 58Q70 64 67 78M120 58Q130 64 133 78" fill="none" stroke={P.gold} strokeWidth="2.4" strokeLinecap="round" />
          <path d={star(100, 52.5, 3.6)} fill={P.cinnabar} />
        </>
      )}
      {bearded && (
        <>
          <path d="M79 76C79 97 88 108 100 108C112 108 121 97 121 76C117 88 110 94 100 94C90 94 83 88 79 76Z" fill={H} stroke={L} strokeWidth="1.2" />
          <path d="M92 88Q100 84 108 88Q100 90.5 92 88Z" fill={H} stroke={L} strokeWidth="1" />
          <path d="M78 76C74 50 84 40 100 40C116 40 126 50 122 76C119 62 112 54 100 54C88 54 81 62 78 76Z" fill={H} stroke={L} strokeWidth="1.2" />
        </>
      )}
      {/* props held behind the hands */}
      {pose === 'book' && (
        <g>
          <rect x="76" y="150" width="48" height="58" rx="3" fill={P.gold} stroke={P.goldDeep} strokeWidth="1.6" />
          <rect x="81" y="155" width="38" height="48" rx="2" fill="none" stroke={P.goldDeep} strokeWidth="1" />
          <path d="M100 162V196M88 174H112" stroke={P.cinnabar} strokeWidth="3" strokeLinecap="round" />
          {[
            [84, 158],
            [116, 158],
            [84, 200],
            [116, 200],
          ].map(([x, y], i) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill={i % 2 ? P.lapis : P.cinnabar} />
          ))}
        </g>
      )}
      {pose === 'scroll' && (
        <g>
          <path d="M58 160H142V190H58Z" fill={P.ivory} stroke={L} strokeWidth="1.3" />
          <rect x="52" y="156" width="10" height="38" rx="5" fill={P.ivoryShade} stroke={L} strokeWidth="1.2" />
          <rect x="138" y="156" width="10" height="38" rx="5" fill={P.ivoryShade} stroke={L} strokeWidth="1.2" />
          <path d="M72 170H128M72 180H116" stroke={P.cinnabar} strokeWidth="2" strokeLinecap="round" strokeOpacity=".8" />
        </g>
      )}
      {arms.map((arm, i) => arm && <Sleeve key={`s${i}`} from={arm[0]} to={[arm[1][0], arm[1][1] + 8]} color={C} />)}
      {arms.map((arm, i) => arm && <Hand key={`h${i}`} x={arm[1][0]} y={arm[1][1]} rotation={arm[2]} skin={S} />)}
    </svg>
  )
}
