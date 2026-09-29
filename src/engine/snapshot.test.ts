import { describe, expect, it } from 'vitest'
import { createClock, historyMsPerSecond, seek, tick } from './clock'
import { chapterAt, compileCampaign, getSnapshot } from './snapshot'
import { DAY_MS, HOUR_MS, parseHistTime } from './time'
import { makeCampaign } from './testFixture'

const c = compileCampaign(makeCampaign())
const at = (s: string) => parseHistTime(s).start

describe('getSnapshot', () => {
  it('是时间的纯函数：相同输入相同输出，与调用顺序无关', () => {
    const t1 = at('1935-01-01T12:00')
    const t2 = at('1935-01-03T12:00')
    const a = getSnapshot(c, t1)
    getSnapshot(c, t2)
    getSnapshot(c, at('1935-01-09'))
    expect(getSnapshot(c, t1)).toEqual(a)
  })

  it('部队位置与阶段', () => {
    expect(getSnapshot(c, at('1934-12-31')).units[0]!.phase).toBe('before')
    const mid = getSnapshot(c, at('1935-01-01T12:00')).units[0]!
    expect(mid.phase).toBe('active')
    expect(mid.pos[0]).toBeCloseTo(0.5, 6)
    expect(getSnapshot(c, at('1935-01-08')).units[0]!.phase).toBe('after')
  })

  it('lifespan 限定可见窗口（to 含当天全天），不影响缺省行为', () => {
    expect(getSnapshot(c, at('1934-12-31')).units[0]!.visible).toBe(false)
    expect(getSnapshot(c, at('1935-01-08')).units[0]!.visible).toBe(true)
    const base = makeCampaign()
    const windowed = compileCampaign(
      makeCampaign({
        units: [{ ...base.units[0]!, lifespan: { from: '1935-01-02', to: '1935-01-03' } }],
      }),
    )
    const vis = (t: string) => getSnapshot(windowed, at(t)).units[0]!.visible
    expect(vis('1935-01-01T12:00')).toBe(false)
    expect(vis('1935-01-02')).toBe(true)
    expect(vis('1935-01-03T23:00')).toBe(true)
    expect(vis('1935-01-04')).toBe(false)
  })

  it('兵力取不晚于当前时刻的最近记录', () => {
    expect(getSnapshot(c, at('1935-01-01T12:00')).units[0]!.strength).toBe(1000)
    expect(getSnapshot(c, at('1935-01-05')).units[0]!.strength).toBe(800)
    expect(getSnapshot(c, at('1934-12-31')).units[0]!.strength).toBeUndefined()
  })

  it('trailMs=0 时不计算尾迹', () => {
    expect(getSnapshot(c, at('1935-01-01T12:00'), { trailMs: 0 }).units[0]!.trail).toEqual([])
    expect(getSnapshot(c, at('1935-01-01T12:00')).units[0]!.trail.length).toBeGreaterThan(1)
  })

  it('事件：upcoming → active → past', () => {
    const ev = (t: string) => getSnapshot(c, at(t)).events[0]!.phase
    expect(ev('1935-01-02T05:00')).toBe('upcoming')
    expect(ev('1935-01-02T07:00')).toBe('active')
    expect(ev('1935-01-03T00:00')).toBe('past')
  })

  it('箭头：起止同日时一次画完，停留 arrowLingerMs 后消失', () => {
    expect(getSnapshot(c, at('1935-01-04T23:00')).arrows).toHaveLength(0)
    const during = getSnapshot(c, at('1935-01-05T12:00')).arrows[0]!
    expect(during.phase).toBe('growing')
    expect(during.progress).toBeCloseTo(0.5, 6)
    expect(during.coords.at(-1)![0]).toBeCloseTo(0.5, 6)
    const done = getSnapshot(c, at('1935-01-06T12:00')).arrows[0]!
    expect(done.phase).toBe('complete')
    expect(getSnapshot(c, at('1935-01-06T12:00'), { arrowLingerMs: 0 }).arrows).toHaveLength(0)
  })

  it('区域：阶跃切换，geometry 为 null 时消失', () => {
    expect(getSnapshot(c, at('1935-01-01')).areas).toHaveLength(0)
    expect(getSnapshot(c, at('1935-01-03')).areas).toHaveLength(1)
    expect(getSnapshot(c, at('1935-01-06')).areas).toHaveLength(0)
  })

  it('章节：边界处取后一章，章外为 undefined', () => {
    expect(chapterAt(c, at('1935-01-02'))!.id).toBe('ch-1')
    expect(chapterAt(c, at('1935-01-05'))!.id).toBe('ch-2')
    // ch-1 结束于 1 月 3 日当天末尾（= 1 月 4 日 0 点），同一时刻 ch-2 开始，取后者
    expect(chapterAt(c, at('1935-01-04'))!.id).toBe('ch-2')
    expect(chapterAt(c, at('1934-12-31'))).toBeUndefined()
    expect(getSnapshot(c, at('1935-01-02')).chapterId).toBe('ch-1')
  })
})

describe('clock', () => {
  it('章节速度覆盖战役默认速度', () => {
    expect(historyMsPerSecond(c, at('1935-01-02'))).toBe(12 * HOUR_MS)
    expect(historyMsPerSecond(c, at('1935-01-05'))).toBe(24 * HOUR_MS)
  })

  it('暂停时不推进', () => {
    const s = createClock(c)
    expect(tick(s, c, 1000)).toBe(s)
  })

  it('播放：1× 速度下每真实秒推进 hoursPerSecond 小时；倍速线性放大', () => {
    const s = createClock(c, { playing: true })
    expect(tick(s, c, 1000).t - s.t).toBe(12 * HOUR_MS)
    expect(tick({ ...s, speed: 2 }, c, 1000).t - s.t).toBe(24 * HOUR_MS)
  })

  it('到达终点自动暂停并停在终点', () => {
    const s = createClock(c, { playing: true, t: c.tEnd - DAY_MS / 100 })
    const next = tick(s, c, 60_000)
    expect(next.t).toBe(c.tEnd)
    expect(next.playing).toBe(false)
  })

  it('seek 会夹在战役范围内', () => {
    const s = createClock(c)
    expect(seek(s, c, c.tStart - 1e9).t).toBe(c.tStart)
    expect(seek(s, c, c.tEnd + 1e9).t).toBe(c.tEnd)
  })
})
