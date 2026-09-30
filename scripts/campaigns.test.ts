import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOUR_MS, compileCampaign, getSnapshot, parseHistTime, timeSettingsAt } from '../src/engine'
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

describe('normandy-1944：分钟精度与章节级时间尺度', () => {
  const c = loaded.find((l) => l.id === 'normandy-1944')?.campaign
  if (!c) throw new Error('缺少 normandy-1944')
  const compiled = compileCampaign(c)
  const at = (s: string) => parseHistTime(s).start
  const snap = (t: string) => getSnapshot(compiled, at(t))
  const unit = (t: string, id: string) => snap(t).units.find((u) => u.id === id)!

  it('章节首尾相接：没有空档也没有重叠，覆盖整个战役', () => {
    const ch = compiled.chapters
    expect(ch[0]!.start).toBe(compiled.tStart)
    expect(ch.at(-1)!.end).toBe(compiled.tEnd)
    for (let i = 1; i < ch.length; i++) expect(ch[i]!.start, ch[i]!.chapter.id).toBe(ch[i - 1]!.end)
  })

  it('D 日按分钟读数、步长随章节缩小；6 月 7 日起按天', () => {
    const s = (t: string) => timeSettingsAt(compiled, at(t))
    expect(s('1944-06-06T00:20')).toMatchObject({ displayPrecision: 'minute', stepDays: 1 / 48 })
    expect(s('1944-06-06T06:30')).toMatchObject({ displayPrecision: 'minute', stepDays: 1 / 96 })
    expect(s('1944-06-06T23:59')).toMatchObject({ displayPrecision: 'minute', stepDays: 1 / 24 })
    expect(s('1944-06-07T00:00')).toMatchObject({ displayPrecision: 'day', stepDays: 1 })
    expect(s('1944-06-12T12:00')).toMatchObject({ displayPrecision: 'day', stepDays: 1 })
  })

  it('飞马桥：滑翔机 00:16 落在桥边，此前在空中，起飞前不显示', () => {
    expect(unit('1944-06-05T22:00', 'uk-ox-bucks').visible).toBe(false)
    const flying = unit('1944-06-06T00:00', 'uk-ox-bucks')
    expect(flying.visible).toBe(true)
    expect(flying.pos[0]).toBeGreaterThan(-2.09) // 已离开起飞机场
    expect(flying.pos[1]).toBeLessThan(50.85)
    const landed = unit('1944-06-06T00:16', 'uk-ox-bucks')
    expect(landed.pos[0]).toBeCloseTo(-0.2744, 3)
    expect(landed.pos[1]).toBeCloseTo(49.2422, 3)
  })

  it('各滩头首波在各自的 H 时刻出现在海滩上，此前不显示', () => {
    const h: [string, string, string][] = [
      ['us-4th-div', '1944-06-06T06:30', 'Utah'],
      ['us-29th-div', '1944-06-06T06:30', 'Omaha'],
      ['uk-50th-div', '1944-06-06T07:25', 'Gold'],
      ['uk-3rd-div', '1944-06-06T07:30', 'Sword'],
      ['ca-3rd-div', '1944-06-06T07:35', 'Juno'],
    ]
    for (const [id, t, beach] of h) {
      expect(
        unit(new Date(at(t) - 60_000).toISOString().slice(0, 16), id).visible,
        `${beach} H-1`,
      ).toBe(false)
      const u = unit(t, id)
      expect(u.visible, `${beach} H`).toBe(true)
      expect(u.pos[1], beach).toBeGreaterThan(49.3) // 都在海岸线上，而不是海峡中央
      expect(u.pos[1], beach).toBeLessThan(49.45)
    }
  })

  it('第 21 装甲师 20:00 前后到达利翁苏梅尔海岸', () => {
    const u = unit('1944-06-06T20:00', 'de-21st-panzer')
    expect(u.pos[0]).toBeCloseTo(-0.3155, 3)
    expect(u.pos[1]).toBeCloseTo(49.3006, 3)
  })

  it('海上编队只在 D 日显示', () => {
    expect(unit('1944-06-06T12:00', 'fleet-u').visible).toBe(true)
    expect(unit('1944-06-07T12:00', 'fleet-u').visible).toBe(false)
  })

  it('分钟级事件与天级事件混用：各自按自己的精度停留', () => {
    const phase = (t: string, id: string) => snap(t).events.find((e) => e.id === id)!.phase
    expect(phase('1944-06-06T00:10', 'e-pegasus-bridge')).toBe('upcoming')
    expect(phase('1944-06-06T00:30', 'e-pegasus-bridge')).toBe('active')
    expect(phase('1944-06-06T02:00', 'e-pegasus-bridge')).toBe('past')
    expect(phase('1944-06-07T12:00', 'e-bayeux')).toBe('active')
    expect(phase('1944-06-08T12:00', 'e-bayeux')).toBe('past')
  })

  it('D 日的路径点和事件都写到分钟（除明确只有“某日”的事件）', () => {
    const minute = /T\d{2}:\d{2}$/
    for (const e of c.events.filter((e) => e.t < '1944-06-07')) expect(e.t, e.id).toMatch(minute)
    for (const u of c.units)
      for (const w of u.track.waypoints.filter((w) => w.t < '1944-06-07'))
        expect(w.t, `${u.id}@${w.t}`).toMatch(minute)
  })
})
