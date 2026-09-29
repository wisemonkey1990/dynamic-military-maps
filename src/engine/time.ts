/**
 * 历史时间：ISO 8601 扩展格式，天文纪年（公元前 216 年写作 -0215）。
 * 字符串按"当时当地的墙上时钟"解释，内部一律当作 UTC 毫秒，引擎不做时区换算。
 *
 *   "1935"              年
 *   "1935-01"           月
 *   "1935-01-29"        日
 *   "1935-01-29T06:30"  分钟
 */

export const TIME_PRECISIONS = ['minute', 'hour', 'day', 'month', 'season', 'year'] as const
export type TimePrecision = (typeof TIME_PRECISIONS)[number]

export const HIST_TIME_RE = /^(-?\d{4,6})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}))?)?)?$/

/** 一个时间点在其精度下所代表的时间区间 [start, end) */
export interface TimeSpan {
  start: number
  end: number
  /** 动画插值使用的时刻：分钟精度取起点（就是那一刻），其余取区间中点 */
  mid: number
  precision: TimePrecision
}

export class TimeParseError extends Error {}

const MS = { minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const

function utc(year: number, month = 1, day = 1, hour = 0, minute = 0): number {
  const d = new Date(0)
  d.setUTCFullYear(year, month - 1, day)
  d.setUTCHours(hour, minute, 0, 0)
  return d.getTime()
}

function addMonths(ms: number, months: number): number {
  const d = new Date(ms)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.getTime()
}

/** 数字越大精度越粗 */
export function precisionRank(p: TimePrecision): number {
  return TIME_PRECISIONS.indexOf(p)
}

export function coarserPrecision(a: TimePrecision, b: TimePrecision): TimePrecision {
  return precisionRank(a) >= precisionRank(b) ? a : b
}

export function parseHistTime(input: string, precision?: TimePrecision): TimeSpan {
  const m = HIST_TIME_RE.exec(input)
  if (!m) throw new TimeParseError(`无法解析的历史时间: "${input}"`)
  const year = Number(m[1])
  const month = m[2] === undefined ? undefined : Number(m[2])
  const day = m[3] === undefined ? undefined : Number(m[3])
  const hour = m[4] === undefined ? undefined : Number(m[4])
  const minute = m[5] === undefined ? undefined : Number(m[5])

  if (month !== undefined && (month < 1 || month > 12)) {
    throw new TimeParseError(`月份越界: "${input}"`)
  }
  if (hour !== undefined && (hour > 23 || (minute ?? 0) > 59)) {
    throw new TimeParseError(`时间越界: "${input}"`)
  }
  const ms = utc(year, month ?? 1, day ?? 1, hour ?? 0, minute ?? 0)
  if (day !== undefined) {
    const check = new Date(ms)
    if (check.getUTCDate() !== day) throw new TimeParseError(`日期不存在: "${input}"`)
  }

  const inferred: TimePrecision =
    hour !== undefined
      ? 'minute'
      : day !== undefined
        ? 'day'
        : month !== undefined
          ? 'month'
          : 'year'
  const p = precision ?? inferred
  if (precisionRank(p) < precisionRank(inferred)) {
    throw new TimeParseError(`精度 ${p} 比字符串 "${input}" 本身更细`)
  }

  let start: number
  let end: number
  switch (p) {
    case 'minute':
      start = ms
      end = ms + MS.minute
      break
    case 'hour':
      start = Math.floor(ms / MS.hour) * MS.hour
      end = start + MS.hour
      break
    case 'day':
      start = utc(year, month ?? 1, day ?? 1)
      end = start + MS.day
      break
    case 'month':
      start = utc(year, month ?? 1)
      end = addMonths(start, 1)
      break
    case 'season':
      start = utc(year, month ?? 1)
      end = addMonths(start, 3)
      break
    case 'year':
      start = utc(year)
      end = utc(year + 1)
      break
  }
  return { start, end, mid: p === 'minute' ? start : (start + end) / 2, precision: p }
}

/** parseHistTime 的反向：毫秒 → "YYYY-MM-DDTHH:mm"（公元前按天文纪年，如 "-0215-08-02T00:00"），用于 URL 等 */
export function toHistTime(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const year = (y < 0 ? '-' : '') + String(Math.abs(y)).padStart(4, '0')
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${year}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}

/** 界面显示用：1935年1月29日 06:30 / 公元前216年 */
export function formatHistTimeZh(ms: number, precision: TimePrecision = 'day'): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const year = y <= 0 ? `公元前${1 - y}年` : `${y}年`
  if (precision === 'year') return year
  const month = `${d.getUTCMonth() + 1}月`
  if (precision === 'month' || precision === 'season') return `${year}${month}`
  const date = `${year}${month}${d.getUTCDate()}日`
  if (precision === 'day') return date
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = precision === 'hour' ? '00' : String(d.getUTCMinutes()).padStart(2, '0')
  return `${date} ${hh}:${mm}`
}

/** 列表里用的短格式，省略年份：1月28日 / 3月 / 1935年（年精度时保留年） */
export function formatHistTimeShortZh(ms: number, precision: TimePrecision = 'day'): string {
  const d = new Date(ms)
  if (precision === 'year') return formatHistTimeZh(ms, 'year')
  if (precision === 'month' || precision === 'season') return `${d.getUTCMonth() + 1}月`
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
}

export const HOUR_MS = MS.hour
export const DAY_MS = MS.day
