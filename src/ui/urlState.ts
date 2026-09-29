import type { LngLat } from '../engine'
import type { Selection } from '../map/MapView'

export interface ViewState {
  center: LngLat
  zoom: number
}

export interface ShareState {
  /** 历史时刻，格式同 toHistTime 的输出 */
  t: string
  view?: ViewState | undefined
  selection?: Selection | undefined
}

const round = (n: number, digits: number) => Number(n.toFixed(digits))

/**
 * 战役页的 hash：#/c/<id>?t=…&c=经度,纬度&z=缩放&s=unit:<id>|event:<id>
 * 手写拼接而不用 URLSearchParams，避免把逗号和冒号转成 %2C、%3A，链接更好读。
 */
export function encodeShareState(campaignId: string, s: ShareState): string {
  const parts = [`t=${s.t}`]
  if (s.view) {
    parts.push(`c=${round(s.view.center[0], 4)},${round(s.view.center[1], 4)}`)
    parts.push(`z=${round(s.view.zoom, 2)}`)
  }
  if (s.selection) parts.push(`s=${s.selection.type}:${encodeURIComponent(s.selection.id)}`)
  return `#/c/${campaignId}?${parts.join('&')}`
}

/** 解析视野与选中项；任何一项格式不对都直接忽略，不报错 */
export function parseShareParams(params: URLSearchParams): {
  view: ViewState | undefined
  selection: Selection | undefined
} {
  let view: ViewState | undefined
  const c = params.get('c')
  const z = params.get('z')
  if (c && z) {
    const [lng, lat] = c.split(',').map(Number)
    const zoom = Number(z)
    if (
      lng !== undefined &&
      lat !== undefined &&
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      Math.abs(lng) <= 180 &&
      Math.abs(lat) <= 90 &&
      Number.isFinite(zoom) &&
      zoom >= 0 &&
      zoom <= 22
    ) {
      view = { center: [lng, lat], zoom }
    }
  }

  let selection: Selection | undefined
  const s = params.get('s')
  if (s) {
    const i = s.indexOf(':')
    const type = s.slice(0, i)
    const id = s.slice(i + 1)
    if ((type === 'unit' || type === 'event') && id) selection = { type, id }
  }
  return { view, selection }
}
