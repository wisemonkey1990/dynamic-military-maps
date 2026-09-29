import { describe, expect, it } from 'vitest'
import {
  bearingDeg,
  cumulativeLengths,
  haversineKm,
  pointAtDistance,
  sliceByDistance,
  type LngLat,
} from './geo'

describe('geo', () => {
  it('赤道上 1 经度约 111.19 公里', () => {
    expect(haversineKm([0, 0], [1, 0])).toBeCloseTo(111.19, 1)
  })

  it('方位角：正东 90，正北 0', () => {
    expect(bearingDeg([0, 0], [1, 0])).toBeCloseTo(90, 3)
    expect(bearingDeg([0, 0], [0, 1])).toBeCloseTo(0, 3)
  })

  const line: LngLat[] = [
    [0, 0],
    [1, 0],
    [1, 1],
  ]
  const cum = cumulativeLengths(line)

  it('沿折线取点：起点、拐点、终点、越界', () => {
    expect(pointAtDistance(line, cum, 0)).toEqual([0, 0])
    expect(pointAtDistance(line, cum, cum[1]!)).toEqual([1, 0])
    expect(pointAtDistance(line, cum, 1e9)).toEqual([1, 1])
    expect(pointAtDistance(line, cum, -5)).toEqual([0, 0])
  })

  it('沿折线取点：段内线性', () => {
    const p = pointAtDistance(line, cum, cum[1]! / 2)
    expect(p[0]).toBeCloseTo(0.5, 6)
    expect(p[1]).toBeCloseTo(0, 6)
  })

  it('切片包含跨越的拐点，且不产生重复端点', () => {
    const s = sliceByDistance(line, cum, cum[1]! / 2, cum[1]! + (cum[2]! - cum[1]!) / 2)
    expect(s).toHaveLength(3)
    expect(s[1]).toEqual([1, 0])
    expect(s[2]![1]).toBeCloseTo(0.5, 6)
  })

  it('零长度折线取点不报错', () => {
    const one: LngLat[] = [
      [3, 3],
      [3, 3],
    ]
    expect(pointAtDistance(one, cumulativeLengths(one), 10)).toEqual([3, 3])
  })
})
