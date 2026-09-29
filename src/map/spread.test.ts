import { describe, expect, it } from 'vitest'
import { spreadOffsets } from './spread'

describe('spreadOffsets', () => {
  it('孤立的点不偏移', () => {
    const o = spreadOffsets([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
    ])
    expect(o.get('a')).toEqual([0, 0])
    expect(o.get('b')).toEqual([0, 0])
  })

  it('重叠的两点向相反方向散开，距离相等', () => {
    const o = spreadOffsets([
      { id: 'a', x: 100, y: 100 },
      { id: 'b', x: 102, y: 101 },
    ])
    const [ax, ay] = o.get('a')!
    const [bx, by] = o.get('b')!
    expect(ax + bx).toBe(0)
    expect(ay + by).toBe(0)
    expect(Math.hypot(ax, ay)).toBeGreaterThan(10)
  })

  it('五个重叠的点各自落在不同位置', () => {
    const pts = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, x: 50, y: 50 }))
    const o = spreadOffsets(pts)
    const keys = new Set([...o.values()].map((v) => v.join(',')))
    expect(keys.size).toBe(5)
  })

  it('重叠组不影响远处的点', () => {
    const o = spreadOffsets([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 1 },
      { id: 'c', x: 500, y: 500 },
    ])
    expect(o.get('c')).toEqual([0, 0])
  })
})
