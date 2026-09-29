import { describe, expect, it } from 'vitest'
import { makeCampaign } from '../engine/testFixture'
import { Campaign } from './campaign'
import { validateCampaign } from './validate'

const errors = (c: Campaign) => validateCampaign(c).filter((i) => i.level === 'error')
const warnings = (c: Campaign) => validateCampaign(c).filter((i) => i.level === 'warning')

describe('schema', () => {
  it('接受最小战役，并为缺省字段填充默认值', () => {
    const c = makeCampaign()
    expect(c.defaultHoursPerSecond).toBe(24)
    expect(c.units[0]!.kind).toBe('infantry')
  })

  it('拒绝非法时间、颜色、id', () => {
    expect(() => makeCampaign({ period: { start: '1935/01/01', end: '1935-01-10' } })).toThrow()
    expect(() => makeCampaign({ sides: [{ id: 'a', name: 'A', color: 'red' }] })).toThrow()
    expect(() => makeCampaign({ id: 'Bad_Id' })).toThrow()
  })
})

describe('validateCampaign', () => {
  it('最小战役没有 error', () => {
    expect(errors(makeCampaign())).toEqual([])
  })

  it('检出重复 id 与悬空引用', () => {
    const base = makeCampaign()
    const c = Campaign.parse({
      ...base,
      units: [
        { ...base.units[0], id: 'dup', side: 'zzz' },
        { ...base.units[0], id: 'dup', sources: ['no-such-source'] },
      ],
      events: [{ ...base.events[0], units: ['ghost'] }],
    })
    const msgs = errors(c)
      .map((i) => i.message)
      .join('\n')
    expect(msgs).toMatch(/重复的 unit id "dup"/)
    expect(msgs).toMatch(/未定义的阵营 "zzz"/)
    expect(msgs).toMatch(/未定义的来源 "no-such-source"/)
    expect(msgs).toMatch(/未定义的部队 "ghost"/)
  })

  it('检出时间倒退的路径点', () => {
    const base = makeCampaign()
    const c = Campaign.parse({
      ...base,
      units: [
        {
          ...base.units[0],
          track: {
            waypoints: [
              { t: '1935-01-03', pos: [0, 0] },
              { t: '1935-01-02', pos: [1, 0] },
            ],
          },
        },
      ],
    })
    expect(errors(c).some((i) => /早于上一路径点/.test(i.message))).toBe(true)
  })

  it('速度过快、瞬移、坐标出界只给 warning', () => {
    const base = makeCampaign()
    const c = Campaign.parse({
      ...base,
      units: [
        {
          ...base.units[0],
          track: {
            waypoints: [
              { t: '1935-01-01T00:00', pos: [0, 0] },
              { t: '1935-01-01T06:00', pos: [1.9, 0] },
              { t: '1935-01-01T06:00', pos: [-0.9, 1.9] },
              { t: '1935-01-02T00:00', pos: [50, 50] },
            ],
          },
        },
      ],
    })
    expect(errors(c)).toEqual([])
    const msgs = warnings(c)
      .map((i) => i.message)
      .join('\n')
    expect(msgs).toMatch(/行军速度/)
    expect(msgs).toMatch(/瞬移/)
    expect(msgs).toMatch(/超出战役 bbox/)
  })

  it('documented 缺来源：草稿 warning，已发布 error', () => {
    const draft = makeCampaign()
    expect(warnings(draft).some((i) => /没有来源/.test(i.message))).toBe(true)
    expect(errors(draft)).toEqual([])
    expect(
      errors(makeCampaign({ status: 'published' })).some((i) => /没有来源/.test(i.message)),
    ).toBe(true)
  })

  it('区域快照时间必须严格递增', () => {
    const base = makeCampaign()
    const c = Campaign.parse({
      ...base,
      areas: [
        {
          ...base.areas[0],
          keyframes: [
            { t: '1935-01-03', geometry: null },
            { t: '1935-01-03', geometry: null },
          ],
        },
      ],
    })
    expect(errors(c).some((i) => /严格递增/.test(i.message))).toBe(true)
  })

  it('章节重叠给 warning', () => {
    const c = makeCampaign({
      chapters: [
        { id: 'x', title: 'X', start: '1935-01-01', end: '1935-01-05' },
        { id: 'y', title: 'Y', start: '1935-01-03', end: '1935-01-08' },
      ],
    })
    expect(warnings(c).some((i) => /重叠/.test(i.message))).toBe(true)
  })

  it('已登记但未被引用的来源给 warning', () => {
    const c = makeCampaign({ sources: [{ id: 'unused', citation: '某书' }] })
    expect(warnings(c).some((i) => /没有被引用/.test(i.message))).toBe(true)
  })
})
