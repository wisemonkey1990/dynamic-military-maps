import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOUR_MS, compileCampaign, getSnapshot, parseHistTime } from '../src/engine'
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

describe('guandu-200：月精度战役', () => {
  const c = loaded.find((l) => l.id === 'guandu-200')?.campaign
  if (!c) throw new Error('缺少 guandu-200')
  const compiled = compileCampaign(c, { eventLingerMs: c.lingerDays * 12 * HOUR_MS })
  const at = (s: string) => parseHistTime(s).start
  const unit = (t: string, id: string) =>
    getSnapshot(compiled, at(t)).units.find((u) => u.id === id)!

  it('史料只记到“月”：所有路径点和事件的时间都是 YYYY-MM，界面按月显示', () => {
    const month = /^\d{4}-\d{2}$/
    for (const u of c.units) for (const w of u.track.waypoints) expect(w.t, u.id).toMatch(month)
    for (const e of c.events) expect(e.t, e.id).toMatch(month)
    expect(c.displayPrecision).toBe('month')
    expect(c.stepDays).toBe(30)
  })

  it('白马之战当月：颜良与关羽前锋同时出现，次月消失', () => {
    expect(unit('0200-05-16', 'yuan-yanliang').visible).toBe(true)
    expect(unit('0200-05-16', 'cao-vanguard').visible).toBe(true)
    expect(unit('0200-07-01', 'yuan-yanliang').visible).toBe(false)
    expect(unit('0200-07-01', 'cao-vanguard').visible).toBe(false)
  })

  it('乌巢之战当月：曹军主力位于乌巢，淳于琼部同处；此前不在', () => {
    const cao = unit('0200-11-16', 'cao-main')
    expect(cao.pos[0]).toBeCloseTo(114.2923, 3)
    expect(cao.pos[1]).toBeCloseTo(35.1018, 3)
    expect(unit('0200-11-16', 'yuan-chunyuqiong').visible).toBe(true)
    expect(unit('0200-10-16', 'yuan-chunyuqiong').visible).toBe(false)
  })

  it('曹军主力在战役末尾（0200-12 之后）不再显示，袁绍主力停在黎阳', () => {
    expect(unit('0201-02-01', 'cao-main').visible).toBe(false)
    expect(unit('0201-02-01', 'yuan-main').pos[1]).toBeCloseTo(35.6794, 3)
  })

  it('章节覆盖整个战役且没有空档', () => {
    expect(getSnapshot(compiled, compiled.tStart).chapterId).toBe('ch1-prelude')
    expect(getSnapshot(compiled, at('0200-11-16')).chapterId).toBe('ch4-wuchao')
    expect(getSnapshot(compiled, compiled.tEnd).chapterId).toBe('ch5-aftermath')
  })
})
