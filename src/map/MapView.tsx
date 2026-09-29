import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// v6 的 worker 是独立的 ES 模块（还会引用 shared 块）；让 Vite 把它连同依赖一起打包，再显式告诉 MapLibre
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Protocol } from 'pmtiles'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CompiledCampaign, LngLat, Snapshot } from '../engine'
import { text } from '../schema/campaign'
import { buildBasemapStyle } from './basemapStyle'
import { areasFC, arrowsFC, EMPTY, routesFC, trailsFC } from './geojson'
import { collectPlaces, createEventElement, createPlaceElement, createUnitElement } from './markers'
import { spreadOffsets } from './spread'

export type Selection = { type: 'unit' | 'event'; id: string }
export interface CameraTarget {
  center: LngLat
  zoom: number
  /** 每次变化都会触发一次飞行，即使目标相同 */
  nonce: number
}

interface Props {
  compiled: CompiledCampaign
  snapshot: Snapshot
  hiddenSides: ReadonlySet<string>
  selected: Selection | undefined
  showPlaces: boolean
  showFullRoutes: boolean
  initialCamera: { center: LngLat; zoom: number }
  camera: CameraTarget | undefined
  onSelect: (s: Selection | undefined) => void
}

/** 窄屏视野小，章节镜头的缩放级别整体降一级，免得部队落在画面之外 */
function adaptZoom(zoom: number): number {
  return window.matchMedia('(max-width: 800px)').matches ? zoom - 1 : zoom
}

let protocolReady = false
function ensurePmtilesProtocol() {
  if (protocolReady) return
  maplibregl.setWorkerUrl(workerUrl)
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  protocolReady = true
}

const CONFIDENCE_DASH: Record<string, number[] | undefined> = {
  documented: undefined,
  reconstructed: undefined,
  approximate: [3, 2],
  conjectural: [0.5, 2.2],
}

function arrowHeadImage(): ImageData {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(size / 2, 3)
  ctx.lineTo(size - 5, size - 5)
  ctx.lineTo(size / 2, size - 11)
  ctx.lineTo(5, size - 5)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

export function MapView({
  compiled,
  snapshot,
  hiddenSides,
  selected,
  showPlaces,
  showFullRoutes,
  initialCamera,
  camera,
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const unitMarkers = useRef(new Map<string, maplibregl.Marker>())
  const eventMarkers = useRef(new Map<string, maplibregl.Marker>())
  const placeMarkers = useRef<maplibregl.Marker[]>([])
  const snapshotRef = useRef(snapshot)
  const hiddenRef = useRef(hiddenSides)
  const onSelectRef = useRef(onSelect)
  // “最新值”引用：让地图事件回调总能读到最新的 props，而不必重建地图
  useEffect(() => {
    snapshotRef.current = snapshot
    hiddenRef.current = hiddenSides
    onSelectRef.current = onSelect
  })

  const initialCameraRef = useRef(initialCamera)
  const campaign = compiled.campaign
  const sides = useMemo(() => new Map(campaign.sides.map((s) => [s.id, s])), [campaign])

  // 创建地图与静态图层
  useEffect(() => {
    ensurePmtilesProtocol()
    const [w, s, e, n] = campaign.bbox
    const map = new maplibregl.Map({
      container: container.current!,
      style: buildBasemapStyle(),
      center: initialCameraRef.current.center,
      zoom: adaptZoom(initialCameraRef.current.zoom),
      minZoom: 5,
      maxZoom: 13,
      maxBounds: [
        [w - 2, s - 2],
        [e + 2, n + 2],
      ],
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map

    map.on('load', () => {
      map.addImage('arrow-head', arrowHeadImage(), { sdf: true })
      map.addSource('areas', { type: 'geojson', data: EMPTY })
      map.addSource('routes', { type: 'geojson', data: EMPTY })
      map.addSource('trails', { type: 'geojson', data: EMPTY })
      map.addSource('arrow-lines', { type: 'geojson', data: EMPTY })
      map.addSource('arrow-heads', { type: 'geojson', data: EMPTY })

      map.addLayer({
        id: 'areas-fill',
        type: 'fill',
        source: 'areas',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 },
      })
      map.addLayer({
        id: 'areas-line',
        type: 'line',
        source: 'areas',
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-dasharray': [4, 2] },
      })

      for (const [conf, dash] of Object.entries(CONFIDENCE_DASH)) {
        const filter: maplibregl.FilterSpecification = ['==', ['get', 'confidence'], conf]
        map.addLayer({
          id: `routes-${conf}`,
          type: 'line',
          source: 'routes',
          filter,
          layout: { 'line-cap': dash ? 'round' : 'butt', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': conf === 'reconstructed' ? 1.6 : 2,
            'line-opacity': 0.32,
            ...(dash ? { 'line-dasharray': dash } : {}),
          },
        })
      }
      map.addLayer({
        id: 'arrows-line',
        type: 'line',
        source: 'arrow-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5,
          'line-opacity': 0.75,
          'line-dasharray': [2, 1.4],
        },
      })
      map.addLayer({
        id: 'arrows-head',
        type: 'symbol',
        source: 'arrow-heads',
        layout: {
          'icon-image': 'arrow-head',
          'icon-size': 0.8,
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': ['get', 'color'], 'icon-opacity': 0.9 },
      })
      for (const [conf, dash] of Object.entries(CONFIDENCE_DASH)) {
        map.addLayer({
          id: `trails-${conf}`,
          type: 'line',
          source: 'trails',
          filter: ['==', ['get', 'confidence'], conf],
          layout: { 'line-cap': dash ? 'round' : 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': conf === 'reconstructed' ? 3 : 4,
            'line-opacity': 0.95,
            ...(dash ? { 'line-dasharray': dash } : {}),
          },
        })
      }

      // 地名（DOM）：来自史料的地名，而不是底图上的今名
      placeMarkers.current = collectPlaces(campaign.units).map((p) =>
        new maplibregl.Marker({
          element: createPlaceElement(p.name),
          anchor: 'top-left',
          offset: [8, 4],
        })
          .setLngLat(p.pos)
          .addTo(map),
      )
      // 事件（DOM）
      for (const ev of campaign.events) {
        const el = createEventElement(ev.kind, text(ev.title))
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current({ type: 'event', id: ev.id })
        })
        eventMarkers.current.set(
          ev.id,
          new maplibregl.Marker({ element: el }).setLngLat(ev.pos).addTo(map),
        )
      }
      // 部队（DOM）
      for (const unit of campaign.units) {
        const side = sides.get(unit.side)
        if (!side) continue
        const el = createUnitElement(unit, side)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current({ type: 'unit', id: unit.id })
        })
        unitMarkers.current.set(
          unit.id,
          new maplibregl.Marker({ element: el }).setLngLat(unit.track.waypoints[0]!.pos).addTo(map),
        )
      }
      setReady(true)
    })
    map.on('click', () => onSelectRef.current(undefined))

    const markers = { units: unitMarkers.current, events: eventMarkers.current }
    return () => {
      setReady(false)
      map.remove()
      mapRef.current = undefined
      markers.units.clear()
      markers.events.clear()
      placeMarkers.current = []
    }
  }, [campaign, sides])

  // 部队标记的屏幕位置：重叠的散开。缩放时重新计算
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const layout = () => {
      const pts = snapshotRef.current.units
        .filter((u) => u.visible && !hiddenRef.current.has(u.side))
        .map((u) => {
          const p = map.project(u.pos)
          return { id: u.id, x: p.x, y: p.y }
        })
      const offsets = spreadOffsets(pts)
      for (const [id, m] of unitMarkers.current) m.setOffset(offsets.get(id) ?? [0, 0])
    }
    layout()
    map.on('zoom', layout)
    return () => {
      map.off('zoom', layout)
    }
  }, [ready, snapshot])

  // 每帧：把引擎快照写到图层与标记上
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const set = (id: string, data: GeoJSON.FeatureCollection) =>
      (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data)
    const arrows = arrowsFC(compiled, snapshot, hiddenSides)
    set('trails', trailsFC(compiled, snapshot, hiddenSides))
    set('arrow-lines', arrows.lines)
    set('arrow-heads', arrows.heads)
    set('areas', areasFC(compiled, snapshot, hiddenSides))
    set('routes', routesFC(compiled, snapshot.t, hiddenSides, showFullRoutes))

    for (const u of snapshot.units) {
      const m = unitMarkers.current.get(u.id)
      if (!m) continue
      m.setLngLat(u.pos)
      const el = m.getElement()
      el.hidden = !u.visible || hiddenSides.has(u.side)
      // 用 data 属性表达状态：直接改 className 会冲掉 MapLibre 给标记加的定位类
      el.dataset.conf = u.confidence
      el.dataset.moving = String(u.moving)
      el.dataset.selected = String(selected?.type === 'unit' && selected.id === u.id)
    }
    for (const ev of snapshot.events) {
      const el = eventMarkers.current.get(ev.id)?.getElement()
      if (!el) continue
      el.hidden = ev.phase === 'upcoming'
      el.dataset.phase = ev.phase
      el.dataset.selected = String(selected?.type === 'event' && selected.id === ev.id)
    }
  }, [ready, compiled, snapshot, hiddenSides, selected, showFullRoutes])

  useEffect(() => {
    for (const m of placeMarkers.current) m.getElement().hidden = !showPlaces
  }, [ready, showPlaces])

  // 镜头
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !camera) return
    map.flyTo({
      center: camera.center,
      zoom: adaptZoom(camera.zoom),
      duration: 1600,
      essential: true,
    })
  }, [ready, camera])

  return <div ref={container} className="map" role="application" aria-label="战役地图" />
}
