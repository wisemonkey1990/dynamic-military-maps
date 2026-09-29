import { chapterAt, type CompiledCampaign } from './snapshot'
import { HOUR_MS } from './time'

/** 虚拟时钟状态。t 为历史时间（毫秒），speed 为用户选择的倍速（1×、2×、0.5×……） */
export interface ClockState {
  t: number
  playing: boolean
  speed: number
}

export function createClock(c: CompiledCampaign, overrides: Partial<ClockState> = {}): ClockState {
  return { t: c.tStart, playing: false, speed: 1, ...overrides }
}

/** 当前时刻的基础速度：每真实秒经过多少历史毫秒（1× 时），章节可覆盖战役默认值 */
export function historyMsPerSecond(c: CompiledCampaign, t: number): number {
  const hours = chapterAt(c, t)?.hoursPerSecond ?? c.campaign.defaultHoursPerSecond
  return hours * HOUR_MS
}

export function seek(state: ClockState, c: CompiledCampaign, t: number): ClockState {
  return { ...state, t: Math.min(c.tEnd, Math.max(c.tStart, t)) }
}

/** 推进 dtRealMs 真实毫秒；到达战役终点时自动暂停 */
export function tick(state: ClockState, c: CompiledCampaign, dtRealMs: number): ClockState {
  if (!state.playing || dtRealMs <= 0) return state
  const advance = (dtRealMs / 1000) * historyMsPerSecond(c, state.t) * state.speed
  const t = state.t + advance
  if (t >= c.tEnd) return { ...state, t: c.tEnd, playing: false }
  return { ...state, t }
}
