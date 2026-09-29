import { describe, expect, it } from 'vitest'
import { Waypoint } from '../schema/campaign'
import { compileTrack, routeSegments, stateAt, trailAt } from './track'
import { parseHistTime } from './time'

const at = (s: string) => parseHistTime(s).mid
const wp = (t: string, pos: [number, number], extra: object = {}) =>
  Waypoint.parse({ t, pos, ...extra })

const track = compileTrack([
  wp('1935-01-01T00:00', [0, 0]),
  wp('1935-01-02T00:00', [1, 0], { confidence: 'approximate' }),
  wp('1935-01-03T00:00', [1, 0]),
  wp('1935-01-04T00:00', [1, 1], { via: [[1.5, 0.5]] }),
])

describe('stateAt', () => {
  it('首点之前 before，位置为首点', () => {
    const s = stateAt(track, at('1934-12-31T00:00'))
    expect(s.phase).toBe('before')
    expect(s.pos).toEqual([0, 0])
  })

  it('段内按时间线性推进', () => {
    const s = stateAt(track, at('1935-01-01T12:00'))
    expect(s.phase).toBe('active')
    expect(s.moving).toBe(true)
    expect(s.pos[0]).toBeCloseTo(0.5, 6)
    expect(s.heading).toBeCloseTo(90, 1)
  })

  it('停留段（前后位置相同）不移动', () => {
    const s = stateAt(track, at('1935-01-02T12:00'))
    expect(s.moving).toBe(false)
    expect(s.pos).toEqual([1, 0])
    expect(s.heading).toBeUndefined()
  })

  it('经过 via 折线，且位置在路径上而不是直线上', () => {
    // 段总长 (1,0)->(1.5,0.5)->(1,1)，中点恰在拐点
    const s = stateAt(track, at('1935-01-03T12:00'))
    expect(s.pos[0]).toBeCloseTo(1.5, 2)
    expect(s.pos[1]).toBeCloseTo(0.5, 2)
  })

  it('末点及之后 after，停在末点', () => {
    const s = stateAt(track, at('1935-02-01T00:00'))
    expect(s.phase).toBe('after')
    expect(s.pos).toEqual([1, 1])
  })

  it('可信度取分段两端中较差者', () => {
    expect(stateAt(track, at('1935-01-01T06:00')).confidence).toBe('approximate')
    expect(stateAt(track, at('1935-01-03T06:00')).confidence).toBe('documented')
  })

  it('单路径点轨迹：之前 before，之后 after', () => {
    const one = compileTrack([wp('1935-01-01T00:00', [5, 5])])
    expect(stateAt(one, at('1935-01-01T00:00') - 1).phase).toBe('before')
    expect(stateAt(one, at('1935-01-01T00:00')).phase).toBe('after')
  })

  it('时间倒退的路径点在编译时抛错', () => {
    expect(() => compileTrack([wp('1935-01-02', [0, 0]), wp('1935-01-01', [1, 1])])).toThrow(/倒退/)
  })

  it('时间相同的两点（瞬移）不会抛错，也不会产生 NaN', () => {
    const t = compileTrack([
      wp('1935-01-01T00:00', [0, 0]),
      wp('1935-01-01T00:00', [1, 1]),
      wp('1935-01-02T00:00', [1, 1]),
    ])
    const s = stateAt(t, at('1935-01-01T12:00'))
    expect(Number.isNaN(s.pos[0])).toBe(false)
  })
})

describe('trailAt / routeSegments', () => {
  it('尾迹只包含窗口内走过的部分', () => {
    const trail = trailAt(track, at('1935-01-02T00:00'), 12 * 3_600_000)
    expect(trail[0]![0]).toBeCloseTo(0.5, 6)
    expect(trail.at(-1)).toEqual([1, 0])
  })

  it('停留期间没有尾迹', () => {
    expect(trailAt(track, at('1935-01-02T12:00'), 3_600_000)).toEqual([])
  })

  it('尾迹跨段时拼接连续、无重复点', () => {
    const trail = trailAt(track, at('1935-01-03T12:00'), 3 * 86_400_000)
    for (let i = 1; i < trail.length; i++) expect(trail[i]).not.toEqual(trail[i - 1])
  })

  it('整条路线跳过零长度分段并保留可信度', () => {
    const segs = routeSegments(track)
    expect(segs).toHaveLength(2)
    expect(segs[0]!.confidence).toBe('approximate')
  })
})
