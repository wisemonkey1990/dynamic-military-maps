import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileCampaign, getSnapshot, parseHistTime } from '../src/engine'
import { loadAllCampaigns } from './loadCampaigns'

const loaded = loadAllCampaigns(join(import.meta.dirname, '../data/campaigns'))

describe('data/campaigns 下的所有战役', () => {
  it('至少有一个战役', () => {
    expect(loaded.length).toBeGreaterThan(0)
  })

  for (const l of loaded) {
    it(`${l.id}：通过 schema 与语义校验（无 error）`, () => {
      const errors = l.issues.filter((i) => i.level === 'error')
      expect(errors, errors.map((e) => `${e.path}: ${e.message}`).join('\n')).toEqual([])
    })
  }
})

describe('sidu-chishui-1935 快照抽查', () => {
  const c = loaded.find((l) => l.id === 'sidu-chishui-1935')?.campaign
  if (!c) throw new Error('缺少 sidu-chishui-1935')
  const compiled = compileCampaign(c)
  const at = (s: string) => parseHistTime(s).start
  const unit = (t: string, id: string) =>
    getSnapshot(compiled, at(t)).units.find((u) => u.id === id)!

  it('1 月 27 日军委纵队在土城，且沿路径推进过来', () => {
    const u = unit('1935-01-27T12:00', 'red-junwei')
    expect(u.pos[0]).toBeCloseTo(105.993, 2)
    expect(u.phase).toBe('active')
  })

  it('2 月 28 日红军占领遵义；敌军吴奇伟纵队仅当日可见', () => {
    expect(unit('1935-02-28T12:00', 'red-junwei').pos[1]).toBeCloseTo(27.725, 2)
    expect(unit('1935-02-28T12:00', 'cn-wu-qiwei').visible).toBe(true)
    expect(unit('1935-02-27T12:00', 'cn-wu-qiwei').visible).toBe(false)
    expect(unit('1935-03-01T12:00', 'cn-wu-qiwei').visible).toBe(false)
  })

  it('播放开始与结束时都有对应章节', () => {
    expect(getSnapshot(compiled, compiled.tStart).chapterId).toBe('ch1-tucheng')
    expect(getSnapshot(compiled, compiled.tEnd).chapterId).toBe('ch8-jinsha')
  })

  it('5 月 9 日结束时军委纵队停在皎平渡', () => {
    const u = unit('1935-05-09T12:00', 'red-junwei')
    expect(u.pos[0]).toBeCloseTo(102.385, 2)
  })
})
