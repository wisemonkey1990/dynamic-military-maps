import { describe, expect, it } from 'vitest'
import { DAY_MS, TimeParseError, formatHistTimeZh, parseHistTime, toHistTime } from './time'

describe('parseHistTime', () => {
  it('按字符串粒度推断精度', () => {
    expect(parseHistTime('1935').precision).toBe('year')
    expect(parseHistTime('1935-01').precision).toBe('month')
    expect(parseHistTime('1935-01-29').precision).toBe('day')
    expect(parseHistTime('1935-01-29T06:30').precision).toBe('minute')
  })

  it('日精度的区间为当天 0 点到次日 0 点，中点为正午', () => {
    const s = parseHistTime('1935-01-29')
    expect(s.end - s.start).toBe(DAY_MS)
    expect(new Date(s.mid).toISOString()).toBe('1935-01-29T12:00:00.000Z')
  })

  it('显式精度可以变粗：季节区间为 3 个月', () => {
    const s = parseHistTime('1935-01', 'season')
    expect(new Date(s.end).toISOString()).toBe('1935-04-01T00:00:00.000Z')
  })

  it('显式精度不能比字符串本身更细', () => {
    expect(() => parseHistTime('1935-01', 'day')).toThrow(TimeParseError)
  })

  it('小时精度向下取整', () => {
    const s = parseHistTime('1944-06-06T06:45', 'hour')
    expect(new Date(s.start).toISOString()).toBe('1944-06-06T06:00:00.000Z')
  })

  it('支持公元前（天文纪年，-0215 即公元前 216 年）', () => {
    const s = parseHistTime('-0215-08-02')
    expect(new Date(s.start).getUTCFullYear()).toBe(-215)
    expect(formatHistTimeZh(s.start, 'day')).toBe('公元前216年8月2日')
  })

  it('拒绝不存在的日期与非法输入', () => {
    expect(() => parseHistTime('1935-02-30')).toThrow(TimeParseError)
    expect(() => parseHistTime('1935-13')).toThrow(TimeParseError)
    expect(() => parseHistTime('1935-01-01T25:00')).toThrow(TimeParseError)
    expect(() => parseHistTime('1935/01/01')).toThrow(TimeParseError)
  })

  it('1–99 年不会被 Date.UTC 误映射到 1900 年代', () => {
    expect(new Date(parseHistTime('0050-01-01').start).getUTCFullYear()).toBe(50)
  })
})

describe('formatHistTimeZh', () => {
  it('按精度格式化', () => {
    const ms = parseHistTime('1944-06-06T06:30').start
    expect(formatHistTimeZh(ms, 'minute')).toBe('1944年6月6日 06:30')
    expect(formatHistTimeZh(ms, 'day')).toBe('1944年6月6日')
    expect(formatHistTimeZh(ms, 'month')).toBe('1944年6月')
    expect(formatHistTimeZh(ms, 'year')).toBe('1944年')
  })
})

describe('toHistTime', () => {
  it('与 parseHistTime 往返一致，含公元前与 1–99 年', () => {
    for (const s of [
      '1935-01-29T12:00',
      '-0215-08-02T00:00',
      '0050-01-01T06:30',
      '1944-06-06T06:30',
    ]) {
      expect(toHistTime(parseHistTime(s).start)).toBe(s)
    }
  })
})
