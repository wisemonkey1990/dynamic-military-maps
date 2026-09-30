import { describe, expect, it } from 'vitest'
import { compileCampaign, getSnapshot, timeSettingsAt } from './snapshot'
import { DAY_MS, HOUR_MS, parseHistTime } from './time'
import { makeCampaign } from './testFixture'

const at = (s: string) => parseHistTime(s).start

/** 第一章按分钟计（步长一小时，尾迹 2 小时，停留 1/24 天）；第二章沿用战役的默认（按日） */
const scaled = makeCampaign({
  chapters: [
    {
      id: 'ch-1',
      title: '第一章',
      start: '1935-01-01',
      end: '1935-01-03',
      scale: {
        displayPrecision: 'minute',
        stepDays: 1 / 24,
        trailDays: 1 / 12,
        lingerDays: 1 / 24,
      },
    },
    { id: 'ch-2', title: '第二章', start: '1935-01-04', end: '1935-01-10' },
  ],
})
const c = compileCampaign(scaled)

describe('章节级时间尺度', () => {
  it('没有 scale 的章节和章外都用战役的默认值', () => {
    const s = timeSettingsAt(c, at('1935-01-05'))
    expect(s).toEqual({ displayPrecision: 'day', stepDays: 1, trailDays: 3, lingerDays: 1 })
    expect(timeSettingsAt(c, at('1934-12-31'))).toEqual(s)
  })

  it('scale 逐项覆盖，未写的项沿用战役设置', () => {
    const partial = compileCampaign(
      makeCampaign({
        trailDays: 5,
        chapters: [
          { id: 'x', title: 'x', start: '1935-01-01', end: '1935-01-10', scale: { stepDays: 0.5 } },
        ],
      }),
    )
    expect(timeSettingsAt(partial, at('1935-01-02'))).toEqual({
      displayPrecision: 'day',
      stepDays: 0.5,
      trailDays: 5,
      lingerDays: 1,
    })
  })

  it('章节边界处取后一章的设置', () => {
    expect(timeSettingsAt(c, at('1935-01-03T23:59')).displayPrecision).toBe('minute')
    expect(timeSettingsAt(c, at('1935-01-04')).displayPrecision).toBe('day')
  })

  it('getSnapshot 的尾迹长度随章节：细尺度章节里尾迹更短', () => {
    // A 部在 1 月 1 日 → 2 日向东行进；取 1 月 2 日 00:00 前后的尾迹
    const fine = getSnapshot(c, at('1935-01-01T20:00')).units[0]!.trail
    const coarse = getSnapshot(compileCampaign(makeCampaign()), at('1935-01-01T20:00')).units[0]!
      .trail
    // 尾迹起点距当前位置：2 小时的行程 < 3 天（从起点开始的全部行程）
    expect(fine[0]![0]).toBeGreaterThan(coarse[0]![0])
    // 显式传入的选项优先于章节设置
    const forced = getSnapshot(c, at('1935-01-01T20:00'), { trailMs: 3 * DAY_MS }).units[0]!.trail
    expect(forced[0]![0]).toBeCloseTo(coarse[0]![0], 9)
  })

  it('箭头停留时长随章节', () => {
    // 箭头在第二章（按日，停留 1 天）
    expect(getSnapshot(c, at('1935-01-06T12:00')).arrows).toHaveLength(1)
    // 把箭头挪进细尺度章节：停留只有 1 小时
    const early = compileCampaign(
      makeCampaign({
        arrows: [
          {
            id: 'arrow-1',
            side: 'a',
            from: '1935-01-02T00:00',
            to: '1935-01-02T02:00',
            path: [
              [0, 0],
              [1, 0],
            ],
          },
        ],
        chapters: scaled.chapters,
      }),
    )
    expect(getSnapshot(early, at('1935-01-02T02:30')).arrows).toHaveLength(1)
    expect(getSnapshot(early, at('1935-01-02T04:30')).arrows).toHaveLength(0)
  })

  it('事件的停留时长取事件开始时所在章节的 lingerDays 的一半', () => {
    const ev = (t: string, comp = compileCampaign(scaledWithEvents)) => {
      const list = getSnapshot(comp, at(t)).events
      return Object.fromEntries(list.map((e) => [e.id, e.phase]))
    }
    const scaledWithEvents = makeCampaign({
      events: [
        { id: 'fine', t: '1935-01-02T06:00', pos: [1, 0], title: '细尺度' },
        { id: 'coarse', t: '1935-01-06T06:00', pos: [1, 0], title: '粗尺度' },
      ],
      chapters: scaled.chapters,
    })
    // 细尺度：lingerDays=1/24 → 停留 30 分钟（事件精度区间只有 1 分钟）
    expect(ev('1935-01-02T06:20').fine).toBe('active')
    expect(ev('1935-01-02T06:40').fine).toBe('past')
    // 粗尺度：lingerDays=1 → 停留 12 小时
    expect(ev('1935-01-06T17:00').coarse).toBe('active')
    expect(ev('1935-01-06T19:00').coarse).toBe('past')
    // 显式的 eventLingerMs 一律优先
    const forced = compileCampaign(scaledWithEvents, { eventLingerMs: 2 * HOUR_MS })
    expect(ev('1935-01-02T07:00', forced).fine).toBe('active')
    expect(ev('1935-01-02T08:30', forced).fine).toBe('past')
  })
})
