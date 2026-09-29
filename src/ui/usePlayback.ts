import { useCallback, useEffect, useRef, useState } from 'react'
import { createClock, seek, tick, type ClockState, type CompiledCampaign } from '../engine'

export function usePlayback(compiled: CompiledCampaign, initialT?: number) {
  const [clock, setClock] = useState<ClockState>(() =>
    seek(createClock(compiled), compiled, initialT ?? compiled.tStart),
  )
  const last = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!clock.playing) {
      last.current = undefined
      return
    }
    let raf = 0
    const step = (now: number) => {
      // 标签页在后台时 rAF 会暂停，恢复后不要一次跳很远
      const dt = last.current === undefined ? 0 : Math.min(100, now - last.current)
      last.current = now
      setClock((c) => tick(c, compiled, dt))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [clock.playing, compiled])

  const play = useCallback(
    () =>
      setClock((c) =>
        c.t >= compiled.tEnd
          ? { ...seek(c, compiled, compiled.tStart), playing: true }
          : { ...c, playing: true },
      ),
    [compiled],
  )
  const pause = useCallback(() => setClock((c) => ({ ...c, playing: false })), [])
  const toggle = useCallback(() => (clock.playing ? pause() : play()), [clock.playing, pause, play])
  const seekTo = useCallback((t: number) => setClock((c) => seek(c, compiled, t)), [compiled])
  const setSpeed = useCallback((speed: number) => setClock((c) => ({ ...c, speed })), [])

  return { clock, play, pause, toggle, seekTo, setSpeed }
}
