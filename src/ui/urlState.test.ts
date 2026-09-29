import { describe, expect, it } from 'vitest'
import { encodeShareState, parseShareParams } from './urlState'

const parse = (hash: string) => parseShareParams(new URLSearchParams(hash.split('?')[1]))

describe('分享链接状态', () => {
  it('只有时间时不带视野和选中项', () => {
    expect(encodeShareState('demo', { t: '1935-02-25T12:00' })).toBe('#/c/demo?t=1935-02-25T12:00')
  })

  it('编码后再解析能还原视野与选中项，数字保留合理精度', () => {
    const hash = encodeShareState('demo', {
      t: '1935-02-25T12:00',
      view: { center: [106.853612345, 28.02634999], zoom: 9.456789 },
      selection: { type: 'unit', id: 'red-junwei' },
    })
    expect(hash).toBe('#/c/demo?t=1935-02-25T12:00&c=106.8536,28.0263&z=9.46&s=unit:red-junwei')
    expect(parse(hash)).toEqual({
      view: { center: [106.8536, 28.0263], zoom: 9.46 },
      selection: { type: 'unit', id: 'red-junwei' },
    })
  })

  it('非法参数被忽略而不是报错', () => {
    expect(parse('#/c/x?c=abc,def&z=9').view).toBeUndefined()
    expect(parse('#/c/x?c=106,28').view).toBeUndefined() // 缺 z
    expect(parse('#/c/x?c=200,28&z=9').view).toBeUndefined() // 经度越界
    expect(parse('#/c/x?c=106,28&z=99').view).toBeUndefined() // 缩放越界
    expect(parse('#/c/x?s=weapon:ak47').selection).toBeUndefined()
    expect(parse('#/c/x?s=unit:').selection).toBeUndefined()
    expect(parse('#/c/x?s=nocolon').selection).toBeUndefined()
  })

  it('事件选中项同样可往返', () => {
    const hash = encodeShareState('demo', {
      t: '1935-01-28T00:00',
      selection: { type: 'event', id: 'battle-tucheng' },
    })
    expect(parse(hash).selection).toEqual({ type: 'event', id: 'battle-tucheng' })
  })
})
