import { useEffect, useRef } from 'react'
import type { CompiledCampaign } from '../engine'
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
  /** 窄屏抽屉是否打开，以及关闭它的回调 */
  open: boolean
  onClose: () => void
}

export function Sidebar(p: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const { open } = p
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
    </nav>
  )
}
