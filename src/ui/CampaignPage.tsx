import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  chapterAt,
  compileCampaign,
  formatHistTimeZh,
  getSnapshot,
  latestEvent,
  parseHistTime,
  toHistTime,
  type CompiledCampaign,
} from '../engine'
import { MapView, type CameraTarget, type Selection } from '../map/MapView'
import { text, type Campaign } from '../schema/campaign'
import { DetailPanel } from './DetailPanel'
import { EVENT_KIND_LABEL } from './labels'
import { Legend } from './Legend'
import { Sidebar } from './Sidebar'
import { Timeline } from './Timeline'
import { usePlayback } from './usePlayback'

function initialTime(compiled: CompiledCampaign, param: string | null): number {
  if (param) {
    try {
      return parseHistTime(param).start
    } catch {
      /* 非法的 t 参数：忽略，从头开始 */
    }
  }
  return compiled.tStart
}

export function CampaignPage({ campaign, tParam }: { campaign: Campaign; tParam: string | null }) {
  const compiled = useMemo(() => compileCampaign(campaign), [campaign])
  const { clock, pause, toggle, seekTo, setSpeed } = usePlayback(
    compiled,
    initialTime(compiled, tParam),
  )
  const snapshot = useMemo(() => getSnapshot(compiled, clock.t), [compiled, clock.t])

  const [selected, setSelected] = useState<Selection | undefined>()
  const [hiddenSides, setHiddenSides] = useState<ReadonlySet<string>>(new Set())
  const [followChapters, setFollowChapters] = useState(true)
  const [pauseOnEvent, setPauseOnEvent] = useState(false)
  const [showPlaces, setShowPlaces] = useState(true)
  const [showFullRoutes, setShowFullRoutes] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [camera, setCamera] = useState<CameraTarget | undefined>()
  const nonce = useRef(0)
  // 打开带 t 的链接时，镜头直接对准当时所在章节
  const [initialCamera] = useState(() => chapterAt(compiled, clock.t)?.camera ?? campaign.camera)

  const fly = useCallback((center: [number, number], zoom: number) => {
    nonce.current += 1
    setCamera({ center, zoom, nonce: nonce.current })
  }, [])

  const chapterById = useCallback(
    (id: string) => compiled.chapters.find((c) => c.chapter.id === id),
    [compiled],
  )

  // 播放中章节变化：镜头跟随
  const lastChapter = useRef<string | undefined>(snapshot.chapterId)
  useEffect(() => {
    if (snapshot.chapterId === lastChapter.current) return
    lastChapter.current = snapshot.chapterId
    const cam = snapshot.chapterId ? chapterById(snapshot.chapterId)?.chapter.camera : undefined
    if (followChapters && clock.playing && cam) fly(cam.center, cam.zoom)
  }, [snapshot.chapterId, followChapters, clock.playing, chapterById, fly])

  // 每个新事件暂停
  const lastEventId = useRef(latestEvent(compiled, clock.t)?.id)
  const currentEvent = latestEvent(compiled, clock.t)
  useEffect(() => {
    const id = currentEvent?.id
    if (id !== lastEventId.current) {
      const advanced = id !== undefined && clock.playing
      lastEventId.current = id
      if (advanced && pauseOnEvent) pause()
    }
  }, [currentEvent?.id, clock.playing, pauseOnEvent, pause])

  const jumpToChapter = useCallback(
    (id: string) => {
      const ch = chapterById(id)
      if (!ch) return
      seekTo(ch.start)
      if (ch.chapter.camera) fly(ch.chapter.camera.center, ch.chapter.camera.zoom)
      setMenuOpen(false)
    },
    [chapterById, seekTo, fly],
  )

  const resetView = useCallback(
    () => fly(campaign.camera.center, campaign.camera.zoom),
    [campaign, fly],
  )

  // URL 同步：暂停时把当前时刻写进地址栏，方便分享
  useEffect(() => {
    if (clock.playing) return
    const h = window.setTimeout(() => {
      window.history.replaceState(null, '', `#/c/${campaign.id}?t=${toHistTime(clock.t)}`)
    }, 300)
    return () => window.clearTimeout(h)
  }, [clock.t, clock.playing, campaign.id])

  useEffect(() => {
    document.title = `${text(campaign.title)} · 战史地图`
    return () => {
      document.title = '战史地图 · 历史军事行动动态地图'
    }
  }, [campaign.title])

  // 键盘：空格播放/暂停，左右键 ±1 天
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'BUTTON')
      )
        return
      if (e.key === ' ') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'ArrowRight') seekTo(clock.t + 86_400_000)
      else if (e.key === 'ArrowLeft') seekTo(clock.t - 86_400_000)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, seekTo, clock.t])

  const toggleSide = (id: string) =>
    setHiddenSides((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className={`campaign${menuOpen ? ' menu-open' : ''}`}>
      <Sidebar
        compiled={compiled}
        chapterId={snapshot.chapterId}
        hiddenSides={hiddenSides}
        followChapters={followChapters}
        pauseOnEvent={pauseOnEvent}
        showPlaces={showPlaces}
        showFullRoutes={showFullRoutes}
        onChapter={jumpToChapter}
        onToggleSide={toggleSide}
        onFollow={setFollowChapters}
        onPauseOnEvent={setPauseOnEvent}
        onShowPlaces={setShowPlaces}
        onShowFullRoutes={setShowFullRoutes}
        onResetView={resetView}
      />
      <div className="stage">
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="章节与图层"
        >
          ☰
        </button>
        <MapView
          compiled={compiled}
          snapshot={snapshot}
          hiddenSides={hiddenSides}
          selected={selected}
          showPlaces={showPlaces}
          showFullRoutes={showFullRoutes}
          initialCamera={initialCamera}
          camera={camera}
          onSelect={setSelected}
        />
        {currentEvent && !selected && (
          <button
            type="button"
            className="event-card"
            onClick={() => setSelected({ type: 'event', id: currentEvent.id })}
          >
            <span className="event-card-meta">
              {EVENT_KIND_LABEL[currentEvent.kind] ?? currentEvent.kind} ·{' '}
              {formatHistTimeZh(
                parseHistTime(currentEvent.t, currentEvent.precision).start,
                parseHistTime(currentEvent.t, currentEvent.precision).precision,
              )}
            </span>
            <strong>{text(currentEvent.title)}</strong>
            {currentEvent.body && (
              <span className="event-card-body">{text(currentEvent.body)}</span>
            )}
          </button>
        )}
        {selected && (
          <DetailPanel
            compiled={compiled}
            t={clock.t}
            selected={selected}
            onClose={() => setSelected(undefined)}
            onSelect={setSelected}
          />
        )}
        <Legend campaign={campaign} />
      </div>
      <Timeline
        compiled={compiled}
        t={clock.t}
        playing={clock.playing}
        speed={clock.speed}
        chapterId={snapshot.chapterId}
        onToggle={toggle}
        onSeek={seekTo}
        onSpeed={setSpeed}
      />
    </div>
  )
}
