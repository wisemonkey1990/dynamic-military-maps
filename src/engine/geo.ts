export type LngLat = [lng: number, lat: number]

const R_KM = 6371.0088
const rad = (d: number) => (d * Math.PI) / 180

/** 两点间大圆距离（千米） */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1])
  const dLng = rad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 起点指向终点的方位角，0=正北，顺时针，单位度 */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]))
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function lerp(a: LngLat, b: LngLat, f: number): LngLat {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** 折线累计长度：cumulative[i] 为从起点到第 i 个顶点的千米数 */
export function cumulativeLengths(coords: readonly LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1]! + haversineKm(coords[i - 1]!, coords[i]!))
  }
  return out
}

export function polylineLengthKm(coords: readonly LngLat[]): number {
  return cumulativeLengths(coords).at(-1) ?? 0
}

/** 沿折线取距离起点 distKm 处的点（按各段内线性插值） */
export function pointAtDistance(
  coords: readonly LngLat[],
  cumulative: readonly number[],
  distKm: number,
): LngLat {
  const total = cumulative.at(-1) ?? 0
  if (coords.length === 0) throw new Error('空折线')
  if (distKm <= 0 || total === 0) return coords[0]!
  if (distKm >= total) return coords.at(-1)!
  let lo = 0
  let hi = cumulative.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cumulative[mid]! <= distKm) lo = mid
    else hi = mid
  }
  const segLen = cumulative[hi]! - cumulative[lo]!
  const f = segLen === 0 ? 0 : (distKm - cumulative[lo]!) / segLen
  return lerp(coords[lo]!, coords[hi]!, f)
}

/** 取折线中 [fromKm, toKm] 之间的部分（含两端插值点） */
export function sliceByDistance(
  coords: readonly LngLat[],
  cumulative: readonly number[],
  fromKm: number,
  toKm: number,
): LngLat[] {
  const total = cumulative.at(-1) ?? 0
  const a = Math.max(0, Math.min(fromKm, total))
  const b = Math.max(a, Math.min(toKm, total))
  const out: LngLat[] = [pointAtDistance(coords, cumulative, a)]
  for (let i = 0; i < coords.length; i++) {
    const c = cumulative[i]!
    if (c > a && c < b) out.push(coords[i]!)
  }
  const end = pointAtDistance(coords, cumulative, b)
  const last = out.at(-1)!
  if (out.length === 1 || last[0] !== end[0] || last[1] !== end[1]) out.push(end)
  return out
}
