/**
 * Procedural botanical illustration for levels 1–20 (+ circles): data only, so
 * the stage mapping can be unit-tested. Coordinates live in a 240×200 box whose
 * ground line is y = 168.
 */
export const GROUND_Y = 168

export type PlantPart =
  | { kind: 'stem'; d: string; width: number }
  | { kind: 'leaf'; x: number; y: number; angle: number; size: number }
  | { kind: 'bud'; x: number; y: number; size: number }
  | { kind: 'flower'; x: number; y: number; size: number }
  | { kind: 'fruit'; x: number; y: number; size: number }
  | { kind: 'seed'; x: number; y: number }
  | { kind: 'crown'; x: number; y: number; rx: number; ry: number }
  | { kind: 'trunk'; x: number; top: number; width: number }
  | { kind: 'roots'; x: number; depth: number; spread: number }
  | { kind: 'sun'; x: number; y: number; r: number; rays: number }
  | { kind: 'path'; d: string }

export interface PlantScene {
  stage: number
  parts: PlantPart[]
  /** Past level 20: one gilded ring per circle (max 5 drawn). */
  rings: number
}

function sprout(x: number, height: number, leafPairs: number, leafSize: number): PlantPart[] {
  const top = GROUND_Y - height
  const parts: PlantPart[] = [{ kind: 'stem', d: `M${x} ${GROUND_Y} C ${x - 2} ${GROUND_Y - height * 0.4}, ${x + 3} ${GROUND_Y - height * 0.7}, ${x} ${top}`, width: 2.4 }]
  for (let i = 0; i < leafPairs; i++) {
    const y = GROUND_Y - height * (0.35 + (0.55 * (i + 1)) / (leafPairs + 1))
    const size = leafSize * (1 - i * 0.12)
    parts.push({ kind: 'leaf', x, y, angle: -35 - i * 4, size }, { kind: 'leaf', x, y: y - 4, angle: 215 + i * 4, size: size * 0.92 })
  }
  return parts
}

function tree(x: number, height: number, crown: number, extras: { fruit?: number; blossom?: number } = {}): PlantPart[] {
  const top = GROUND_Y - height
  const parts: PlantPart[] = [
    { kind: 'trunk', x, top: top + crown * 0.4, width: Math.max(3, height / 14) },
    { kind: 'crown', x, y: top, rx: crown, ry: crown * 0.82 },
  ]
  for (let i = 0; i < (extras.fruit ?? 0); i++) {
    const a = (i / Math.max(1, extras.fruit ?? 1)) * Math.PI * 2 + 0.6
    parts.push({ kind: 'fruit', x: x + Math.cos(a) * crown * 0.55, y: top + Math.sin(a) * crown * 0.45, size: Math.max(3, crown / 7) })
  }
  for (let i = 0; i < (extras.blossom ?? 0); i++) {
    const a = (i / Math.max(1, extras.blossom ?? 1)) * Math.PI * 2 + 1.3
    parts.push({ kind: 'flower', x: x + Math.cos(a) * crown * 0.6, y: top + Math.sin(a) * crown * 0.5, size: Math.max(3, crown / 8) })
  }
  return parts
}

/** Level → scene (spec §9.3: Seed … Garden, Teleo; circles beyond 20). */
export function plantScene(level: number): PlantScene {
  const stage = Math.max(1, Math.min(20, Math.floor(level)))
  const rings = Math.max(0, Math.floor(level) - 20)
  const c = 120
  let parts: PlantPart[]
  switch (stage) {
    case 1:
      parts = [{ kind: 'seed', x: c, y: GROUND_Y + 6 }]
      break
    case 2:
      parts = [{ kind: 'seed', x: c, y: GROUND_Y + 8 }, ...sprout(c, 18, 1, 9)]
      break
    case 3:
      parts = sprout(c, 34, 1, 14)
      break
    case 4:
      parts = sprout(c, 52, 2, 16)
      break
    case 5:
      parts = sprout(c, 74, 3, 17)
      break
    case 6:
      parts = sprout(c, 82, 4, 22)
      break
    case 7:
      parts = [...sprout(c, 92, 4, 21), { kind: 'bud', x: c, y: GROUND_Y - 94, size: 7 }]
      break
    case 8:
      parts = [...sprout(c, 96, 4, 21), { kind: 'flower', x: c, y: GROUND_Y - 100, size: 13 }]
      break
    case 9:
      parts = [...sprout(c, 96, 4, 21), { kind: 'flower', x: c, y: GROUND_Y - 100, size: 10 }, { kind: 'fruit', x: c + 18, y: GROUND_Y - 70, size: 6 }, { kind: 'fruit', x: c - 17, y: GROUND_Y - 58, size: 5 }]
      break
    case 10:
      parts = [...sprout(c - 26, 58, 2, 16), ...sprout(c + 24, 64, 2, 16), ...sprout(c, 80, 3, 18), { kind: 'flower', x: c - 26, y: GROUND_Y - 60, size: 7 }, { kind: 'fruit', x: c + 26, y: GROUND_Y - 62, size: 5 }]
      break
    case 11:
      parts = tree(c, 92, 26)
      break
    case 12:
      parts = tree(c, 116, 40)
      break
    case 13:
      parts = [...tree(c, 118, 42), { kind: 'roots', x: c, depth: 24, spread: 44 }]
      break
    case 14:
      parts = [...tree(c, 122, 58), { kind: 'roots', x: c, depth: 24, spread: 52 }]
      break
    case 15:
      parts = [...tree(c - 62, 82, 26), ...tree(c + 62, 88, 28), ...tree(c, 124, 44)]
      break
    case 16:
      parts = [...tree(c - 64, 84, 28, { fruit: 4 }), ...tree(c + 64, 86, 28, { fruit: 4 }), ...tree(c, 118, 40, { fruit: 6 })]
      break
    case 17:
      parts = [...tree(c - 84, 70, 22), ...tree(c + 84, 74, 22), ...tree(c - 42, 104, 32), ...tree(c + 44, 110, 34), ...tree(c, 132, 44)]
      break
    case 18:
      parts = [...tree(c - 86, 100, 30), ...tree(c + 86, 104, 30), ...tree(c - 42, 132, 40), ...tree(c + 44, 138, 42), ...tree(c, 150, 50), { kind: 'roots', x: c, depth: 22, spread: 70 }]
      break
    case 19:
      parts = [
        { kind: 'path', d: `M${c - 12} 200 Q ${c - 4} 184 ${c} ${GROUND_Y}` },
        ...tree(c - 74, 104, 34, { blossom: 5 }),
        ...tree(c + 76, 110, 36, { fruit: 5 }),
        ...sprout(c - 30, 30, 1, 10),
        { kind: 'flower', x: c - 30, y: GROUND_Y - 32, size: 7 },
        ...sprout(c + 30, 34, 1, 10),
        { kind: 'flower', x: c + 30, y: GROUND_Y - 36, size: 7 },
        ...tree(c, 132, 42, { blossom: 4 }),
      ]
      break
    default:
      parts = [
        { kind: 'sun', x: c, y: 44, r: 16, rays: 12 },
        { kind: 'path', d: `M${c - 12} 200 Q ${c - 4} 184 ${c} ${GROUND_Y}` },
        ...tree(c - 78, 106, 34, { blossom: 5 }),
        ...tree(c + 78, 110, 36, { fruit: 5 }),
        ...sprout(c - 32, 32, 1, 10),
        { kind: 'flower', x: c - 32, y: GROUND_Y - 34, size: 8 },
        ...sprout(c + 32, 36, 1, 10),
        { kind: 'flower', x: c + 32, y: GROUND_Y - 38, size: 8 },
        ...tree(c, 120, 40, { fruit: 3, blossom: 3 }),
      ]
  }
  return { stage, parts, rings }
}
