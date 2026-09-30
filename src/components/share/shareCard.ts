import { APP_URL } from '@/components/support/links'

/** Pigments of the card: fixed (a shared picture has no theme), the light "gilded icon" palette. */
const INK = {
  vellum: '#f4ecda',
  ivory: '#fbf6ea',
  umber: '#231a14',
  soft: '#54463a',
  gold: '#b8862a',
  goldInk: '#7a5410',
  goldSoft: '#f1dfae',
  lapis: '#1f3b8c',
} as const

const SIZE = 1080
const SERIF = '"Alegreya Variable", Alegreya, Georgia, serif'
const SANS = '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif'
const SMALL_CAPS = '"Alegreya SC", "Alegreya Variable", Georgia, serif'

export interface CardContent {
  /** Rubric at the top, e.g. the date. */
  rubric: string
  title: string
  /** Up to four big numbers with a label under each. */
  stats: Array<{ value: string; label: string }>
  /** Optional line under the numbers (Bible progress). */
  note?: string
  motto: string
  /** Markup of a Figure/Character SVG (fixed pigments, so it renders without the page's CSS). */
  figureSvg?: string
}

function loadSvg(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('figure'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })
}

/** Makes an inline SVG element a standalone file (namespace, fixed size). */
export function standaloneSvg(svg: SVGSVGElement, width: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const [, , vw = 200, vh = 220] = (svg.getAttribute('viewBox') ?? '0 0 200 220').split(/\s+/).map(Number)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(Math.round((width * vh) / vw)))
  clone.removeAttribute('style')
  return new XMLSerializer().serializeToString(clone)
}

async function fontsReady(): Promise<void> {
  if (!document.fonts) return
  // fillText draws with a fallback until a face is loaded, so ask for the exact faces used.
  await Promise.allSettled([
    document.fonts.load(`600 64px ${SERIF}`),
    document.fonts.load(`italic 500 34px ${SERIF}`),
    document.fonts.load(`700 30px ${SMALL_CAPS}`),
    document.fonts.load(`600 72px ${SANS}`),
  ])
  await document.fonts.ready
}

function frame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = INK.vellum
  ctx.fillRect(0, 0, SIZE, SIZE)
  // A warm light-pool, as at the top of every screen.
  const glow = ctx.createRadialGradient(SIZE / 2, 330, 40, SIZE / 2, 330, 560)
  glow.addColorStop(0, 'rgba(241, 223, 174, 0.95)')
  glow.addColorStop(1, 'rgba(244, 236, 218, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, SIZE, SIZE)
  // The icon frame: a gilded double rule inside the edge.
  ctx.strokeStyle = INK.gold
  ctx.lineWidth = 4
  ctx.strokeRect(44, 44, SIZE - 88, SIZE - 88)
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1.5
  ctx.strokeRect(60, 60, SIZE - 120, SIZE - 120)
  ctx.globalAlpha = 1
}

function giltRule(ctx: CanvasRenderingContext2D, y: number, half: number) {
  const rule = ctx.createLinearGradient(SIZE / 2 - half, 0, SIZE / 2 + half, 0)
  rule.addColorStop(0, 'rgba(184, 134, 42, 0)')
  rule.addColorStop(0.2, INK.gold)
  rule.addColorStop(0.8, INK.gold)
  rule.addColorStop(1, 'rgba(184, 134, 42, 0)')
  ctx.fillStyle = rule
  ctx.globalAlpha = 0.7
  ctx.fillRect(SIZE / 2 - half, y, half * 2, 2)
  ctx.globalAlpha = 1
}

/** Square card (fits every social feed uncropped) with the day's numbers and the user's figure. */
export async function drawShareCard(content: CardContent): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  await fontsReady()
  frame(ctx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = INK.goldInk
  ctx.font = `700 30px ${SMALL_CAPS}`
  ctx.fillText(content.rubric.toLowerCase(), SIZE / 2, 128, SIZE - 220)
  ctx.fillStyle = INK.umber
  ctx.font = `600 64px ${SERIF}`
  // A long session title is narrowed rather than cut.
  ctx.fillText(content.title, SIZE / 2, 200, SIZE - 220)
  giltRule(ctx, 226, 300)

  // Without a note line the figure grows into its room, so the card has no empty band.
  let top = content.note ? 250 : 262
  const figure = content.figureSvg ? await loadSvg(content.figureSvg).catch(() => null) : null
  if (figure) {
    const height = content.note ? 300 : 360
    const width = (figure.width / figure.height) * height
    ctx.drawImage(figure, (SIZE - width) / 2, top, width, height)
    top += height + 20
  }

  // Up to four numbers in one row, separated by gold hairlines.
  const stats = content.stats.slice(0, 4)
  const column = (SIZE - 160) / Math.max(1, stats.length)
  stats.forEach((stat, i) => {
    const cx = 80 + column * i + column / 2
    ctx.fillStyle = INK.umber
    ctx.font = `600 72px ${SANS}`
    ctx.fillText(stat.value, cx, top + 80)
    ctx.fillStyle = INK.soft
    ctx.font = `500 26px ${SANS}`
    ctx.fillText(stat.label, cx, top + 122)
    if (i > 0) {
      ctx.fillStyle = INK.gold
      ctx.globalAlpha = 0.5
      ctx.fillRect(80 + column * i, top + 20, 2, 110)
      ctx.globalAlpha = 1
    }
  })
  top += 170

  if (content.note) {
    ctx.fillStyle = INK.lapis
    ctx.font = `600 32px ${SERIF}`
    ctx.fillText(content.note, SIZE / 2, top + 20)
  }

  giltRule(ctx, SIZE - 190, 220)
  ctx.fillStyle = INK.goldInk
  ctx.font = `italic 500 40px ${SERIF}`
  ctx.fillText(content.motto, SIZE / 2, SIZE - 132)
  ctx.fillStyle = INK.soft
  ctx.font = `600 26px ${SANS}`
  ctx.fillText(APP_URL.replace(/^https:\/\//, '').replace(/\/$/, ''), SIZE / 2, SIZE - 88)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png')
  })
}
