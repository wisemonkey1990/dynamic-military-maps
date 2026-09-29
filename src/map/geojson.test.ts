import { describe, expect, it } from 'vitest'
import { compileCampaign, getSnapshot, parseHistTime } from '../engine'
import { makeCampaign } from '../engine/testFixture'
import { areasFC, arrowsFC, routesFC, selectedRouteFC, trailsFC } from './geojson'

const c = compileCampaign(makeCampaign())
const at = (s: string) => parseHistTime(s).start
const none = new Set<string>()

describe('routesFC', () => {
  it('默认只含已走过的路线：开始前为空，走到一半时只到当前位置', () => {
    expect(routesFC(c, at('1934-12-31'), none).features).toHaveLength(0)
    const half = routesFC(c, at('1935-01-01T12:00'), none).features
    expect(half).toHaveLength(1)
    const coords = (half[0]!.geometry as GeoJSON.LineString).coordinates
    expect(coords.at(-1)![0]).toBeCloseTo(0.5, 6)
  })

  it('full=true 时给出完整路线（停留段不产生线）', () => {
    const full = routesFC(c, at('1935-01-01'), none, true).features
    expect(full).toHaveLength(2)
    expect(full[0]!.properties!.confidence).toBe('approximate')
  })

  it('隐藏的阵营不出现', () => {
    expect(routesFC(c, at('1935-01-08'), new Set(['a'])).features).toHaveLength(0)
  })
})

describe('trailsFC / arrowsFC / areasFC', () => {
  it('尾迹只包含可见且有位移的部队', () => {
    const snap = getSnapshot(c, at('1935-01-01T12:00'))
    expect(trailsFC(c, snap, none).features).toHaveLength(1)
    expect(trailsFC(c, snap, new Set(['a'])).features).toHaveLength(0)
    // 轨迹在 1 月 4 日结束；尾迹窗口是 3 天，到 1 月 9 日已经没有可画的部分
    expect(trailsFC(c, getSnapshot(c, at('1935-01-09')), none).features).toHaveLength(0)
  })

  it('箭头：线身加箭头点，箭头方位角朝向行进方向（正东 = 90°）', () => {
    const snap = getSnapshot(c, at('1935-01-05T12:00'))
    const { lines, heads } = arrowsFC(c, snap, none)
    expect(lines.features).toHaveLength(1)
    expect(heads.features).toHaveLength(1)
    expect(heads.features[0]!.properties!.bearing).toBeCloseTo(90, 1)
  })

  it('箭头尚未开始或已消失时为空', () => {
    expect(arrowsFC(c, getSnapshot(c, at('1935-01-01')), none).lines.features).toHaveLength(0)
    expect(arrowsFC(c, getSnapshot(c, at('1935-01-09')), none).lines.features).toHaveLength(0)
  })

  it('区域按阶跃快照输出，消失后为空', () => {
    expect(areasFC(c, getSnapshot(c, at('1935-01-03')), none).features).toHaveLength(1)
    expect(areasFC(c, getSnapshot(c, at('1935-01-07')), none).features).toHaveLength(0)
  })
})

describe('selectedRouteFC', () => {
  it('给出所选部队的完整路线，与当前时刻无关', () => {
    const fcs = selectedRouteFC(c, 'unit-a', none)
    expect(fcs.features).toHaveLength(2)
    expect(fcs.features.every((f) => f.properties!.unitId === 'unit-a')).toBe(true)
  })

  it('未选中、未知部队或阵营被隐藏时为空', () => {
    expect(selectedRouteFC(c, undefined, none).features).toHaveLength(0)
    expect(selectedRouteFC(c, 'nope', none).features).toHaveLength(0)
    expect(selectedRouteFC(c, 'unit-a', new Set(['a'])).features).toHaveLength(0)
  })
})
