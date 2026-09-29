import type { Side, Unit } from '../schema/campaign'
import { text } from '../schema/campaign'

const NS = 'http://www.w3.org/2000/svg'

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`)
  }
  return pts.join(' ')
}

const SHAPES: Record<Side['icon'], { tag: string; attrs: Record<string, string>; textY: number }> =
  {
    circle: { tag: 'circle', attrs: { cx: '14', cy: '14', r: '11' }, textY: 14.5 },
    square: {
      tag: 'rect',
      attrs: { x: '3', y: '3', width: '22', height: '22', rx: '3' },
      textY: 14.5,
    },
    diamond: { tag: 'polygon', attrs: { points: '14,1.5 26.5,14 14,26.5 1.5,14' }, textY: 14.5 },
    triangle: { tag: 'polygon', attrs: { points: '14,2 26.5,25 1.5,25' }, textY: 18.5 },
    star: { tag: 'polygon', attrs: { points: starPoints(14, 14.5, 13.5, 6) }, textY: 15 },
  }

/** 部队标记：阵营决定形状与颜色（不只靠颜色区分），中间是简称 */
export function createUnitElement(unit: Unit, side: Side): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'unit-marker'
  el.dataset.unit = unit.id
  const name = text(unit.name)
  el.setAttribute('aria-label', name)
  el.title = name

  const shape = SHAPES[side.icon]
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 28 28')
  svg.setAttribute('width', '30')
  svg.setAttribute('height', '30')
  svg.setAttribute('aria-hidden', 'true')
  const body = document.createElementNS(NS, shape.tag)
  for (const [k, v] of Object.entries(shape.attrs)) body.setAttribute(k, v)
  body.setAttribute('fill', side.color)
  body.setAttribute('class', 'unit-shape')
  svg.appendChild(body)
  const label = document.createElementNS(NS, 'text')
  label.setAttribute('x', '14')
  label.setAttribute('y', String(shape.textY))
  label.setAttribute('text-anchor', 'middle')
  label.setAttribute('dominant-baseline', 'central')
  label.setAttribute('class', 'unit-short')
  label.textContent = unit.short ?? [...name][0] ?? '?'
  svg.appendChild(label)
  el.appendChild(svg)

  const caption = document.createElement('span')
  caption.className = 'marker-caption'
  caption.textContent = name
  el.appendChild(caption)
  return el
}

export function createEventElement(kind: string, title: string): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `event-marker kind-${kind}`
  el.setAttribute('aria-label', title)
  const dot = document.createElement('span')
  dot.className = 'event-dot'
  el.appendChild(dot)
  const caption = document.createElement('span')
  caption.className = 'marker-caption'
  caption.textContent = title
  el.appendChild(caption)
  return el
}

export function createPlaceElement(name: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'place-label'
  el.textContent = name
  return el
}

export interface PlaceLabel {
  name: string
  pos: [number, number]
}

/** 从各部队路径点里收集地名（同一位置只留第一个名字，跳过推测的点） */
export function collectPlaces(units: readonly Unit[]): PlaceLabel[] {
  const seen = new Set<string>()
  const out: PlaceLabel[] = []
  for (const u of units) {
    for (const w of u.track.waypoints) {
      if (!w.place || w.confidence === 'conjectural') continue
      const key = `${w.pos[0].toFixed(2)},${w.pos[1].toFixed(2)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ name: text(w.place), pos: w.pos })
    }
  }
  return out
}
