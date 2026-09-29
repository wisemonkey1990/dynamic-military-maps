import { useEffect, useRef, useState } from 'react'
import { formatHistTimeShortZh, parseHistTime, type CompiledCampaign } from '../engine'
import { text } from '../schema/campaign'

interface Props {
  compiled: CompiledCampaign
  chapterId: string | undefined
  hiddenSides: ReadonlySet<string>
  followChapters: boolean
  pauseOnEvent: boolean
  showPlaces: boolean
  showFullRoutes: boolean
  onChapter: (id: string) => void
  onToggleSide: (id: string) => void
  onFollow: (v: boolean) => void
  onPauseOnEvent: (v: boolean) => void
  onShowPlaces: (v: boolean) => void
  onShowFullRoutes: (v: boolean) => void
  onResetView: () => void
  /** 事件列表：当前（最近发生的）事件 id，以及点击某个事件的回调 */
  currentEventId: string | undefined
  onEvent: (id: string) => void
  /** 复制分享链接，返回是否成功 */
  onShare: () => Promise<boolean>
  /** 窄屏抽屉是否打开，以及关闭它的回调 */
  open: boolean
  onClose: () => void
}

export function Sidebar(p: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const { open } = p
  const [shareMsg, setShareMsg] = useState('')
  const shareTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(shareTimer.current), [])
  const share = async () => {
    const ok = await p.onShare()
    setShareMsg(ok ? '已复制链接' : '复制失败，请直接复制地址栏')
    window.clearTimeout(shareTimer.current)
    shareTimer.current = window.setTimeout(() => setShareMsg(''), 2500)
  }
  // 抽屉打开时把焦点移到 × 按钮，键盘用户可以直接关闭
  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])
  const c = p.compiled.campaign
  return (
    <nav className="sidebar" aria-label="战役导航">
      <button
        ref={closeRef}
        type="button"
        className="drawer-close"
        onClick={p.onClose}
        aria-label="关闭菜单"
      >
        ×
      </button>
      <a className="back" href="#/">
        ← 全部战役
      </a>
      <h1>{text(c.title)}</h1>
      {c.subtitle && <p className="muted">{text(c.subtitle)}</p>}
      {c.status === 'draft' && <p className="draft-note">数据为草稿，尚未审核，请勿当作定论。</p>}

      <h2>章节</h2>
      <ol className="chapters">
        {p.compiled.chapters.map(({ chapter }, i) => (
          <li key={chapter.id}>
            <button
              type="button"
              aria-current={chapter.id === p.chapterId ? 'true' : undefined}
              onClick={() => p.onChapter(chapter.id)}
            >
              <span className="num">{i + 1}</span>
              <span>{text(chapter.title)}</span>
            </button>
            {chapter.id === p.chapterId && chapter.narration && (
              <p className="narration">{text(chapter.narration)}</p>
            )}
          </li>
        ))}
      </ol>

      <details className="events-section">
        <summary>事件（{p.compiled.events.length}）</summary>
        <ol className="event-list">
          {p.compiled.events.map(({ event, start }) => (
            <li key={event.id}>
              <button
                type="button"
                aria-current={event.id === p.currentEventId ? 'true' : undefined}
                onClick={() => p.onEvent(event.id)}
              >
                <span className={`event-list-dot kind-${event.kind}`} aria-hidden="true" />
                <span className="event-list-date">
                  {formatHistTimeShortZh(start, parseHistTime(event.t, event.precision).precision)}
                </span>
                <span>{text(event.title)}</span>
              </button>
            </li>
          ))}
        </ol>
      </details>

      <h2>图层</h2>
      <ul className="layers">
        {c.sides.map((s) => (
          <li key={s.id}>
            <label>
              <input
                type="checkbox"
                checked={!p.hiddenSides.has(s.id)}
                onChange={() => p.onToggleSide(s.id)}
              />
              <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
              {text(s.name)}
            </label>
          </li>
        ))}
        <li>
          <label>
            <input
              type="checkbox"
              checked={p.showPlaces}
              onChange={(e) => p.onShowPlaces(e.target.checked)}
            />
            显示地名
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={p.showFullRoutes}
              onChange={(e) => p.onShowFullRoutes(e.target.checked)}
            />
            显示完整路线（含尚未走到的）
          </label>
        </li>
      </ul>

      <h2>播放选项</h2>
      <ul className="layers">
        <li>
          <label>
            <input
              type="checkbox"
              checked={p.followChapters}
              onChange={(e) => p.onFollow(e.target.checked)}
            />
            镜头跟随章节
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={p.pauseOnEvent}
              onChange={(e) => p.onPauseOnEvent(e.target.checked)}
            />
            每个新事件暂停
          </label>
        </li>
      </ul>
      <button type="button" className="secondary" onClick={p.onResetView}>
        重置视野
      </button>

      <h2>分享</h2>
      <button type="button" className="secondary" onClick={share}>
        复制当前视图的链接
      </button>
      <p className="muted" role="status">
        {shareMsg || '链接包含当前时刻、地图视野和选中的对象。'}
      </p>
    </nav>
  )
}
