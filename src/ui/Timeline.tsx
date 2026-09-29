import { formatHistTimeZh, type CompiledCampaign } from '../engine'
import { text } from '../schema/campaign'

const SPEEDS = [0.5, 1, 2, 4]

interface Props {
  compiled: CompiledCampaign
  t: number
  playing: boolean
  speed: number
  chapterId: string | undefined
  onToggle: () => void
  onSeek: (t: number) => void
  onSpeed: (s: number) => void
}

const DAY = 86_400_000

export function Timeline({
  compiled,
  t,
  playing,
  speed,
  chapterId,
  onToggle,
  onSeek,
  onSpeed,
}: Props) {
  const { tStart, tEnd } = compiled
  const span = tEnd - tStart
  const pct = (ms: number) => `${(((ms - tStart) / span) * 100).toFixed(3)}%`
  const chapter = compiled.chapters.find((c) => c.chapter.id === chapterId)?.chapter

  return (
    <div className="timeline">
      <div className="transport">
        <button type="button" onClick={() => onSeek(tStart)} aria-label="回到开头" title="回到开头">
          ⏮
        </button>
        <button
          type="button"
          onClick={() => onSeek(t - DAY)}
          aria-label="后退一天"
          title="后退一天（←）"
        >
          ◀
        </button>
        <button
          type="button"
          className="play"
          onClick={onToggle}
          aria-label={playing ? '暂停' : '播放'}
          title="播放/暂停（空格）"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={() => onSeek(t + DAY)}
          aria-label="前进一天"
          title="前进一天（→）"
        >
          ▶
        </button>
        <label className="speed">
          <span className="sr-only">播放速度</span>
          <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scrub">
        <div className="scrub-readout">
          <strong>{formatHistTimeZh(t, 'day')}</strong>
          {chapter && <span className="chapter-name">{text(chapter.title)}</span>}
        </div>
        <div className="scrub-track">
          <div className="chapter-bands" aria-hidden="true">
            {compiled.chapters.map(({ chapter: ch, start, end }, i) => (
              <div
                key={ch.id}
                className={`band band-${i % 2}${ch.id === chapterId ? ' current' : ''}`}
                style={{ left: pct(start), width: `${(((end - start) / span) * 100).toFixed(3)}%` }}
                title={text(ch.title)}
              />
            ))}
          </div>
          <div className="event-ticks" aria-hidden="true">
            {compiled.events.map(({ event, start }) => (
              <span
                key={event.id}
                className={`tick kind-${event.kind}`}
                style={{ left: pct(start) }}
                title={text(event.title)}
              />
            ))}
          </div>
          <div className="playhead" aria-hidden="true" style={{ left: pct(t) }} />
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(((t - tStart) / span) * 1000)}
            onChange={(e) => onSeek(tStart + (Number(e.target.value) / 1000) * span)}
            aria-label="时间轴"
            aria-valuetext={formatHistTimeZh(t, 'day')}
          />
        </div>
      </div>
    </div>
  )
}
