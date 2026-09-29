import { describe, expect, it } from 'vitest'
import { compileCampaign } from './snapshot'
import { latestEvent, unitContext } from './context'
import { parseHistTime } from './time'
import { makeCampaign } from './testFixture'

const c = compileCampaign(makeCampaign())
const at = (s: string) => parseHistTime(s).start

describe('latestEvent', () => {
  it('第一个事件之前为 undefined，之后一直是它', () => {
    expect(latestEvent(c, at('1935-01-01'))).toBeUndefined()
    expect(latestEvent(c, at('1935-01-02T06:00'))?.id).toBe('ev-1')
    expect(latestEvent(c, at('1935-01-09'))?.id).toBe('ev-1')
  })
})

describe('unitContext', () => {
  it('给出上一个与下一个路径点', () => {
    const ctx = unitContext(c, 'unit-a', at('1935-01-02T12:00'))!
    expect(ctx.prev?.t).toBe('1935-01-02T00:00')
    expect(ctx.next?.t).toBe('1935-01-03T00:00')
  })

  it('首点之前没有 prev，末点之后没有 next；未知部队为 undefined', () => {
    expect(unitContext(c, 'unit-a', at('1934-12-31'))!.prev).toBeUndefined()
    expect(unitContext(c, 'unit-a', at('1935-02-01'))!.next).toBeUndefined()
    expect(unitContext(c, 'nope', 0)).toBeUndefined()
  })
})
