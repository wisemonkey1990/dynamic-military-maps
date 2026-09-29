import type { HistEvent, Waypoint } from '../schema/campaign'
import type { CompiledCampaign } from './snapshot'

/** 时刻 t 已发生的最近一个事件（按事件起点算）；之前没有事件则为 undefined */
export function latestEvent(c: CompiledCampaign, t: number): HistEvent | undefined {
  let found: HistEvent | undefined
  for (const e of c.events) {
    if (e.start <= t) found = e.event
    else break
  }
  return found
}

/** 部队在时刻 t 的“上一个/下一个”路径点，供详情面板显示所在地与说明 */
export function unitContext(
  c: CompiledCampaign,
  unitId: string,
  t: number,
): { prev: Waypoint | undefined; next: Waypoint | undefined } | undefined {
  const cu = c.units.find((u) => u.unit.id === unitId)
  if (!cu) return undefined
  const idx = cu.track.points.findLastIndex((p) => p.t <= t)
  const wps = cu.unit.track.waypoints
  return { prev: idx >= 0 ? wps[idx] : undefined, next: wps[idx + 1] }
}
