import type {
  Area,
  Arrow,
  Campaign,
  Chapter,
  Confidence,
  HistEvent,
  Localized,
  Unit,
} from '../schema/campaign'
import { cumulativeLengths, sliceByDistance, type LngLat } from './geo'
import { DAY_MS, HOUR_MS, parseHistTime } from './time'
import { compileTrack, stateAt, trailAt, type CompiledTrack, type TrackPhase } from './track'
import type { TimePrecision } from './time'

export interface SnapshotOptions {
  /** 事件的默认停留时长（毫秒）。事件自身精度区间更长时以区间为准 */
  eventLingerMs: number
  /** 箭头画完后继续显示的时长 */
  arrowLingerMs: number
  /** 部队尾迹长度；0 表示不计算 */
  trailMs: number
}

export const DEFAULT_SNAPSHOT_OPTIONS: SnapshotOptions = {
  eventLingerMs: 12 * HOUR_MS,
  arrowLingerMs: DAY_MS,
  trailMs: 3 * DAY_MS,
}

interface CompiledUnit {
  unit: Unit
  track: CompiledTrack
  visFrom: number
  visTo: number
  strength: { t: number; value: number }[]
}
interface CompiledEvent {
  event: HistEvent
  start: number
  until: number
}
interface CompiledArrow {
  arrow: Arrow
  from: number
  to: number
  cumulative: number[]
  lengthKm: number
}
interface CompiledArea {
  area: Area
  keyframes: { t: number; geometry: NonNullable<Area['keyframes'][number]['geometry']> | null }[]
}
interface CompiledChapter {
  chapter: Chapter
  start: number
  end: number
}

export interface CompiledCampaign {
  campaign: Campaign
  tStart: number
  tEnd: number
  units: CompiledUnit[]
  events: CompiledEvent[]
  arrows: CompiledArrow[]
  areas: CompiledArea[]
  chapters: CompiledChapter[]
}

export function compileCampaign(
  campaign: Campaign,
  opts: Partial<SnapshotOptions> = {},
): CompiledCampaign {
  const { eventLingerMs } = { ...DEFAULT_SNAPSHOT_OPTIONS, ...opts }
  const units = campaign.units.map((unit) => {
    const track = compileTrack(unit.track.waypoints)
    const { from, to } = unit.lifespan ?? {}
    return {
      unit,
      track,
      visFrom: from ? parseHistTime(from).start : track.tStart,
      visTo: to ? parseHistTime(to).end : Infinity,
      strength: (unit.strength ?? [])
        .map((s) => ({ t: parseHistTime(s.t).mid, value: s.value }))
        .sort((a, b) => a.t - b.t),
    }
  })
  const events = campaign.events
    .map((event) => {
      const span = parseHistTime(event.t, event.precision)
      const until = event.until
        ? parseHistTime(event.until).end
        : Math.max(span.end, span.start + eventLingerMs)
      return { event, start: span.start, until }
    })
    .sort((a, b) => a.start - b.start)
  const arrows = campaign.arrows.map((arrow) => {
    const cumulative = cumulativeLengths(arrow.path as LngLat[])
    return {
      arrow,
      from: parseHistTime(arrow.from).start,
      to: parseHistTime(arrow.to).end,
      cumulative,
      lengthKm: cumulative.at(-1) ?? 0,
    }
  })
  const areas = campaign.areas.map((area) => ({
    area,
    keyframes: area.keyframes
      .map((k) => ({ t: parseHistTime(k.t).start, geometry: k.geometry }))
      .sort((a, b) => a.t - b.t),
  }))
  const chapters = campaign.chapters
    .map((chapter) => ({
      chapter,
      start: parseHistTime(chapter.start).start,
      end: parseHistTime(chapter.end).end,
    }))
    .sort((a, b) => a.start - b.start)
  return {
    campaign,
    tStart: parseHistTime(campaign.period.start).start,
    tEnd: parseHistTime(campaign.period.end).end,
    units,
    events,
    arrows,
    areas,
    chapters,
  }
}

export interface UnitState {
  id: string
  side: string
  /** 是否应在图上显示（受 lifespan 约束）；不可见时其余字段仍然有效 */
  visible: boolean
  phase: TrackPhase
  pos: LngLat
  heading: number | undefined
  moving: boolean
  confidence: Confidence
  precision: TimePrecision
  strength: number | undefined
  trail: LngLat[]
}
export interface EventState {
  id: string
  phase: 'upcoming' | 'active' | 'past'
}
export interface ArrowState {
  id: string
  side: string
  kind: Arrow['kind']
  label: Localized | undefined
  confidence: Confidence
  phase: 'growing' | 'complete'
  /** 0..1 */
  progress: number
  coords: LngLat[]
}
export interface AreaState {
  id: string
  side: string
  kind: Area['kind']
  name: Localized
  confidence: Confidence
  geometry: NonNullable<Area['keyframes'][number]['geometry']>
  /** 当前快照生效的起始时刻 */
  since: number
}
export interface Snapshot {
  t: number
  chapterId: string | undefined
  units: UnitState[]
  events: EventState[]
  arrows: ArrowState[]
  areas: AreaState[]
}

/** 章节：边界处取后一章 */
export function chapterAt(c: CompiledCampaign, t: number): Chapter | undefined {
  let found: Chapter | undefined
  for (const ch of c.chapters) if (t >= ch.start && t <= ch.end) found = ch.chapter
  return found
}

/**
 * 战役在时刻 t 的完整状态——时间的纯函数，无内部状态。
 * 倒放、拖动时间轴、URL 分享 t 复现，都靠这一点成立。
 */
export function getSnapshot(
  c: CompiledCampaign,
  t: number,
  options: Partial<SnapshotOptions> = {},
): Snapshot {
  const opts = { ...DEFAULT_SNAPSHOT_OPTIONS, ...options }

  const units = c.units.map(({ unit, track, strength, visFrom, visTo }): UnitState => {
    const s = stateAt(track, t)
    let currentStrength: number | undefined
    for (const e of strength) if (e.t <= t) currentStrength = e.value
    return {
      id: unit.id,
      side: unit.side,
      visible: t >= visFrom && t < visTo,
      phase: s.phase,
      pos: s.pos,
      heading: s.heading,
      moving: s.moving,
      confidence: s.confidence,
      precision: s.precision,
      strength: currentStrength,
      trail: opts.trailMs > 0 ? trailAt(track, t, opts.trailMs) : [],
    }
  })

  const events = c.events.map(({ event, start, until }): EventState => ({
    id: event.id,
    phase: t < start ? 'upcoming' : t < until ? 'active' : 'past',
  }))

  const arrows: ArrowState[] = []
  for (const a of c.arrows) {
    if (t < a.from || t >= a.to + opts.arrowLingerMs) continue
    const progress = a.to === a.from ? 1 : Math.min(1, Math.max(0, (t - a.from) / (a.to - a.from)))
    arrows.push({
      id: a.arrow.id,
      side: a.arrow.side,
      kind: a.arrow.kind,
      label: a.arrow.label,
      confidence: a.arrow.confidence,
      phase: progress >= 1 ? 'complete' : 'growing',
      progress,
      coords: sliceByDistance(a.arrow.path as LngLat[], a.cumulative, 0, progress * a.lengthKm),
    })
  }

  const areas: AreaState[] = []
  for (const { area, keyframes } of c.areas) {
    let current: (typeof keyframes)[number] | undefined
    for (const k of keyframes) if (k.t <= t) current = k
    if (current?.geometry) {
      areas.push({
        id: area.id,
        side: area.side,
        kind: area.kind,
        name: area.name,
        confidence: area.confidence,
        geometry: current.geometry,
        since: current.t,
      })
    }
  }

  return { t, chapterId: chapterAt(c, t)?.id, units, events, arrows, areas }
}
