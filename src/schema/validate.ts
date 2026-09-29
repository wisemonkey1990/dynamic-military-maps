import { haversineKm, polylineLengthKm, type LngLat } from '../engine/geo'
import { parseHistTime } from '../engine/time'
import type { Campaign, Unit } from './campaign'

export interface Issue {
  level: 'error' | 'warning'
  path: string
  message: string
}

/** 行军速度告警阈值（千米/天）。红军强行军可达 60–90 公里/天，超过即需要人工复核 */
const SPEED_WARN_KM_PER_DAY: Record<Unit['kind'], number> = {
  infantry: 100,
  cavalry: 200,
  armor: 200,
  artillery: 80,
  headquarters: 100,
  mixed: 100,
  fleet: 700,
  other: 300,
}

/**
 * 语义校验：schema 管"长得对不对"，这里管"讲不讲得通"。
 * error 阻断构建；warning 提示复核。
 */
export function validateCampaign(c: Campaign): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message })
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message })
  const published = c.status === 'published'
  /** 缺来源：已发布 → error，否则 warning */
  const missing = (path: string, message: string) => (published ? err : warn)(path, message)

  // —— id 唯一 & 引用完整 ——
  const seen = new Map<string, string>()
  const claim = (kind: string, id: string, path: string) => {
    const key = `${kind}:${id}`
    if (seen.has(key)) err(path, `重复的 ${kind} id "${id}"（另见 ${seen.get(key)}）`)
    else seen.set(key, path)
  }
  c.sides.forEach((s, i) => claim('side', s.id, `sides[${i}]`))
  c.sources.forEach((s, i) => claim('source', s.id, `sources[${i}]`))
  c.units.forEach((u, i) => claim('unit', u.id, `units[${i}]`))
  c.events.forEach((e, i) => claim('event', e.id, `events[${i}]`))
  c.arrows.forEach((a, i) => claim('arrow', a.id, `arrows[${i}]`))
  c.areas.forEach((a, i) => claim('area', a.id, `areas[${i}]`))
  c.chapters.forEach((ch, i) => claim('chapter', ch.id, `chapters[${i}]`))

  const sideIds = new Set(c.sides.map((s) => s.id))
  const sourceIds = new Set(c.sources.map((s) => s.id))
  const unitIds = new Set(c.units.map((u) => u.id))
  const checkSide = (id: string, path: string) => {
    if (!sideIds.has(id)) err(path, `未定义的阵营 "${id}"`)
  }
  const checkSources = (ids: string[] | undefined, path: string) => {
    ids?.forEach((id) => {
      if (!sourceIds.has(id)) err(path, `未定义的来源 "${id}"`)
    })
  }

  // —— 时间与范围 ——
  const tStart = parseHistTime(c.period.start).start
  const tEnd = parseHistTime(c.period.end).end
  if (tEnd <= tStart) err('period', '战役结束时间必须晚于开始时间')
  const [west, south, east, north] = c.bbox
  if (west >= east || south >= north) err('bbox', 'bbox 应为 [西, 南, 东, 北] 且西<东、南<北')
  const inBbox = (p: LngLat) => p[0] >= west && p[0] <= east && p[1] >= south && p[1] <= north
  const checkTime = (iso: string, path: string) => {
    const t = parseHistTime(iso).start
    if (t < tStart || t >= tEnd) warn(path, `时间 ${iso} 超出战役时间范围`)
  }
  const checkPos = (p: LngLat, path: string) => {
    if (!inBbox(p)) warn(path, `坐标 [${p.join(', ')}] 超出战役 bbox`)
  }

  // —— 部队 ——
  c.units.forEach((u, ui) => {
    const up = `units[${ui}](${u.id})`
    checkSide(u.side, `${up}.side`)
    checkSources(u.sources, `${up}.sources`)
    u.strength?.forEach((s, i) => checkSources(s.sources, `${up}.strength[${i}].sources`))
    const wps = u.track.waypoints
    if (u.lifespan) {
      const { from, to } = u.lifespan
      if (from) checkTime(from, `${up}.lifespan.from`)
      if (to) checkTime(to, `${up}.lifespan.to`)
      if (from && to && parseHistTime(to).end <= parseHistTime(from).start)
        err(`${up}.lifespan`, 'lifespan.to 必须晚于 from')
    }
    if (wps.length < 2 && !u.lifespan)
      warn(`${up}.track`, '只有一个路径点且未设置 lifespan，部队将从该时刻起一直停在原地')
    wps.forEach((w, wi) => {
      const wp = `${up}.track.waypoints[${wi}]`
      checkTime(w.t, `${wp}.t`)
      checkPos(w.pos, `${wp}.pos`)
      w.via?.forEach((p, i) => checkPos(p, `${wp}.via[${i}]`))
      checkSources(w.sources, `${wp}.sources`)
      const hasSource = (w.sources?.length ?? 0) > 0 || (u.sources?.length ?? 0) > 0
      if ((w.confidence === 'documented' || w.confidence === 'reconstructed') && !hasSource) {
        missing(wp, `可信度为 ${w.confidence} 但没有来源（本点或部队层面均未登记）`)
      }
      if (wi === 0) return
      const prev = wps[wi - 1]!
      const a = parseHistTime(prev.t, prev.precision).mid
      const b = parseHistTime(w.t, w.precision).mid
      if (b < a) {
        err(`${wp}.t`, `时间早于上一路径点 (${prev.t} → ${w.t})`)
        return
      }
      const km = polylineLengthKm([prev.pos, ...(w.via ?? []), w.pos])
      const days = (b - a) / 86_400_000
      if (days === 0 && km > 1) {
        warn(wp, `与上一路径点时间相同但相距 ${km.toFixed(0)} 公里（瞬移）`)
      } else if (days > 0) {
        const speed = km / days
        if (speed > SPEED_WARN_KM_PER_DAY[u.kind]) {
          warn(
            wp,
            `行军速度 ${speed.toFixed(0)} 公里/天，超过 ${u.kind} 的参考上限 ${SPEED_WARN_KM_PER_DAY[u.kind]}，请复核时间或坐标`,
          )
        }
      }
    })
  })

  // —— 事件 ——
  c.events.forEach((e, i) => {
    const ep = `events[${i}](${e.id})`
    checkTime(e.t, `${ep}.t`)
    checkPos(e.pos, `${ep}.pos`)
    checkSources(e.sources, `${ep}.sources`)
    e.units?.forEach((id) => {
      if (!unitIds.has(id)) err(`${ep}.units`, `未定义的部队 "${id}"`)
    })
    if (e.until && parseHistTime(e.until).end < parseHistTime(e.t).start)
      err(`${ep}.until`, 'until 早于 t')
    if ((e.confidence === 'documented' || e.confidence === 'reconstructed') && !e.sources?.length) {
      missing(ep, `可信度为 ${e.confidence} 但没有来源`)
    }
  })

  // —— 箭头 ——
  c.arrows.forEach((a, i) => {
    const ap = `arrows[${i}](${a.id})`
    checkSide(a.side, `${ap}.side`)
    checkSources(a.sources, `${ap}.sources`)
    checkTime(a.from, `${ap}.from`)
    checkTime(a.to, `${ap}.to`)
    if (parseHistTime(a.to).end < parseHistTime(a.from).start) err(ap, 'to 早于 from')
    a.path.forEach((p, pi) => checkPos(p, `${ap}.path[${pi}]`))
    if (haversineKm(a.path[0]!, a.path.at(-1)!) < 0.1) warn(ap, '箭头起点和终点几乎重合')
  })

  // —— 区域 ——
  c.areas.forEach((a, i) => {
    const ap = `areas[${i}](${a.id})`
    checkSide(a.side, `${ap}.side`)
    checkSources(a.sources, `${ap}.sources`)
    let prev = -Infinity
    a.keyframes.forEach((k, ki) => {
      const t = parseHistTime(k.t).start
      if (t <= prev) err(`${ap}.keyframes[${ki}].t`, '快照时间必须严格递增')
      prev = t
      checkTime(k.t, `${ap}.keyframes[${ki}].t`)
    })
  })

  // —— 章节 ——
  const chapters = c.chapters
    .map((ch, i) => ({ ch, i, s: parseHistTime(ch.start).start, e: parseHistTime(ch.end).end }))
    .sort((a, b) => a.s - b.s)
  chapters.forEach(({ ch, i, s, e }, k) => {
    const cp = `chapters[${i}](${ch.id})`
    if (e <= s) err(cp, '章节结束必须晚于开始')
    if (s < tStart || e > tEnd) warn(cp, '章节超出战役时间范围')
    const next = chapters[k + 1]
    if (next && next.s < e) warn(cp, `与章节 ${next.ch.id} 时间重叠`)
    if (ch.camera && !inBbox(ch.camera.center)) warn(`${cp}.camera`, '镜头中心超出战役 bbox')
  })

  // —— 来源 ——
  const used = new Set<string>()
  const collect = (ids?: string[]) => ids?.forEach((id) => used.add(id))
  c.units.forEach((u) => {
    collect(u.sources)
    u.track.waypoints.forEach((w) => collect(w.sources))
    u.strength?.forEach((s) => collect(s.sources))
  })
  c.events.forEach((e) => collect(e.sources))
  c.arrows.forEach((a) => collect(a.sources))
  c.areas.forEach((a) => collect(a.sources))
  c.sources.forEach((s, i) => {
    if (!used.has(s.id)) warn(`sources[${i}](${s.id})`, '来源已登记但没有被引用')
  })

  return issues
}
