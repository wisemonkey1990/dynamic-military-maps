import { CONFIDENCE_LEVELS, type Confidence, type Waypoint } from '../schema/campaign'
import { bearingDeg, cumulativeLengths, pointAtDistance, sliceByDistance, type LngLat } from './geo'
import { coarserPrecision, parseHistTime, type TimePrecision } from './time'

export function worseConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_LEVELS.indexOf(a) >= CONFIDENCE_LEVELS.indexOf(b) ? a : b
}

export interface TrackPoint {
  t: number
  pos: LngLat
  precision: TimePrecision
  confidence: Confidence
}

/** 相邻两个路径点之间的一段：起点 → via… → 终点，按弧长匀速通过 */
export interface TrackSegment {
  t0: number
  t1: number
  coords: LngLat[]
  cumulative: number[]
  lengthKm: number
  /** 两端点中较差的可信度 */
  confidence: Confidence
  /** 两端点中较粗的时间精度 */
  precision: TimePrecision
}

export interface CompiledTrack {
  tStart: number
  tEnd: number
  points: TrackPoint[]
  segments: TrackSegment[]
}

export function compileTrack(waypoints: readonly Waypoint[]): CompiledTrack {
  if (waypoints.length === 0) throw new Error('轨迹至少需要一个路径点')
  const points: TrackPoint[] = waypoints.map((w) => {
    const span = parseHistTime(w.t, w.precision)
    return { t: span.mid, pos: w.pos, precision: span.precision, confidence: w.confidence }
  })
  const segments: TrackSegment[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (b.t < a.t) {
      throw new Error(
        `路径点时间倒退: 第 ${i} 个点(${waypoints[i]!.t}) 早于上一个点(${waypoints[i - 1]!.t})`,
      )
    }
    const coords: LngLat[] = [a.pos, ...(waypoints[i]!.via ?? []), b.pos]
    const cumulative = cumulativeLengths(coords)
    segments.push({
      t0: a.t,
      t1: b.t,
      coords,
      cumulative,
      lengthKm: cumulative.at(-1) ?? 0,
      confidence: worseConfidence(a.confidence, b.confidence),
      precision: coarserPrecision(a.precision, b.precision),
    })
  }
  return { tStart: points[0]!.t, tEnd: points.at(-1)!.t, points, segments }
}

export type TrackPhase = 'before' | 'active' | 'after'

export interface TrackState {
  phase: TrackPhase
  pos: LngLat
  /** 行进方向，度，0=正北；静止时为 undefined */
  heading: number | undefined
  moving: boolean
  confidence: Confidence
  precision: TimePrecision
}

/** 找到满足 t0 <= t < t1 的分段下标；无则 -1 */
function findSegment(segments: readonly TrackSegment[], t: number): number {
  let lo = 0
  let hi = segments.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const s = segments[mid]!
    if (t < s.t0) hi = mid - 1
    else if (t >= s.t1) lo = mid + 1
    else return mid
  }
  return -1
}

function headingAt(seg: TrackSegment, distKm: number): number | undefined {
  if (seg.lengthKm === 0) return undefined
  const eps = Math.min(0.5, seg.lengthKm / 2)
  const a = pointAtDistance(seg.coords, seg.cumulative, distKm - eps)
  const b = pointAtDistance(seg.coords, seg.cumulative, distKm + eps)
  if (a[0] === b[0] && a[1] === b[1]) return bearingDeg(seg.coords[0]!, seg.coords.at(-1)!)
  return bearingDeg(a, b)
}

export function stateAt(track: CompiledTrack, t: number): TrackState {
  const first = track.points[0]!
  const last = track.points.at(-1)!
  if (t < track.tStart) {
    return {
      phase: 'before',
      pos: first.pos,
      heading: undefined,
      moving: false,
      confidence: first.confidence,
      precision: first.precision,
    }
  }
  if (t >= track.tEnd) {
    const lastSeg = track.segments.at(-1)
    return {
      phase: 'after',
      pos: last.pos,
      heading: lastSeg ? headingAt(lastSeg, lastSeg.lengthKm) : undefined,
      moving: false,
      confidence: last.confidence,
      precision: last.precision,
    }
  }
  const idx = findSegment(track.segments, t)
  if (idx < 0) {
    // 落在时间相同的相邻点之间（瞬移），取后一段起点
    return {
      phase: 'active',
      pos: last.pos,
      heading: undefined,
      moving: false,
      confidence: last.confidence,
      precision: last.precision,
    }
  }
  const seg = track.segments[idx]!
  const f = (t - seg.t0) / (seg.t1 - seg.t0)
  const dist = f * seg.lengthKm
  return {
    phase: 'active',
    pos: pointAtDistance(seg.coords, seg.cumulative, dist),
    heading: headingAt(seg, dist),
    moving: seg.lengthKm > 0,
    confidence: seg.confidence,
    precision: seg.precision,
  }
}

/** 尾迹：最近 windowMs 时间内走过的折线；无位移则返回空数组 */
export function trailAt(track: CompiledTrack, t: number, windowMs: number): LngLat[] {
  const from = Math.max(track.tStart, t - windowMs)
  const to = Math.min(t, track.tEnd)
  if (to <= from) return []
  const out: LngLat[] = []
  for (const seg of track.segments) {
    if (seg.lengthKm === 0 || seg.t1 <= from || seg.t0 >= to) continue
    const o0 = Math.max(seg.t0, from)
    const o1 = Math.min(seg.t1, to)
    const span = seg.t1 - seg.t0
    const piece = sliceByDistance(
      seg.coords,
      seg.cumulative,
      ((o0 - seg.t0) / span) * seg.lengthKm,
      ((o1 - seg.t0) / span) * seg.lengthKm,
    )
    const prev = out.at(-1)
    out.push(
      ...(prev && prev[0] === piece[0]![0] && prev[1] === piece[0]![1] ? piece.slice(1) : piece),
    )
  }
  return out
}

/** 整条路线，按可信度分段，供界面绘制实线/虚线 */
export function routeSegments(track: CompiledTrack) {
  return track.segments
    .filter((s) => s.lengthKm > 0)
    .map((s) => ({ coords: s.coords, confidence: s.confidence, t0: s.t0, t1: s.t1 }))
}

/** 到时刻 t 为止已经走过的路线（同样按可信度分段），未到的部分不含 */
export function routeUpTo(track: CompiledTrack, t: number) {
  const out: { coords: LngLat[]; confidence: Confidence; t0: number; t1: number }[] = []
  for (const s of track.segments) {
    if (s.lengthKm === 0 || s.t0 >= t) continue
    const f = Math.min(1, (t - s.t0) / (s.t1 - s.t0))
    const coords = f >= 1 ? s.coords : sliceByDistance(s.coords, s.cumulative, 0, f * s.lengthKm)
    out.push({ coords, confidence: s.confidence, t0: s.t0, t1: s.t1 })
  }
  return out
}
