import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon } from 'geojson'
import {
  bearingDeg,
  routeSegments,
  routeUpTo,
  type CompiledCampaign,
  type LngLat,
  type Snapshot,
} from '../engine'
import type { Confidence } from '../schema/campaign'

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

const fc = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features })
const line = (coords: LngLat[], properties: Record<string, unknown>): Feature<LineString> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates: coords },
})

export function sideColors(c: CompiledCampaign): Map<string, string> {
  return new Map(c.campaign.sides.map((s) => [s.id, s.color]))
}

/**
 * 每支部队的路线，按可信度分段。默认只画到时刻 t 为止已走过的部分（不剧透）；
 * full=true 时画完整路线。
 */
export function routesFC(
  c: CompiledCampaign,
  t: number,
  hidden: ReadonlySet<string>,
  full = false,
): FeatureCollection {
  const colors = sideColors(c)
  const features: Feature[] = []
  for (const cu of c.units) {
    if (hidden.has(cu.unit.side)) continue
    for (const seg of full ? routeSegments(cu.track) : routeUpTo(cu.track, t)) {
      features.push(
        line(seg.coords, {
          unitId: cu.unit.id,
          side: cu.unit.side,
          color: colors.get(cu.unit.side) ?? '#666',
          confidence: seg.confidence,
        }),
      )
    }
  }
  return fc(features)
}

/** 部队最近走过的尾迹 */
export function trailsFC(
  c: CompiledCampaign,
  snap: Snapshot,
  hidden: ReadonlySet<string>,
): FeatureCollection {
  const colors = sideColors(c)
  const features: Feature[] = []
  for (const u of snap.units) {
    if (!u.visible || hidden.has(u.side) || u.trail.length < 2) continue
    features.push(
      line(u.trail, {
        unitId: u.id,
        side: u.side,
        color: colors.get(u.side) ?? '#666',
        confidence: u.confidence,
      }),
    )
  }
  return fc(features)
}

/** 箭头：线身 + 箭头（箭头是终点处的一个点，带方位角） */
export function arrowsFC(
  c: CompiledCampaign,
  snap: Snapshot,
  hidden: ReadonlySet<string>,
): { lines: FeatureCollection; heads: FeatureCollection } {
  const colors = sideColors(c)
  const lines: Feature[] = []
  const heads: Feature<Point>[] = []
  for (const a of snap.arrows) {
    if (hidden.has(a.side) || a.coords.length < 2) continue
    const props = {
      id: a.id,
      side: a.side,
      kind: a.kind,
      color: colors.get(a.side) ?? '#666',
      confidence: a.confidence satisfies Confidence,
    }
    lines.push(line(a.coords, props))
    const end = a.coords.at(-1)!
    const prev = a.coords.at(-2)!
    heads.push({
      type: 'Feature',
      properties: { ...props, bearing: bearingDeg(prev, end) },
      geometry: { type: 'Point', coordinates: end },
    })
  }
  return { lines: fc(lines), heads: fc(heads) }
}

export function areasFC(
  c: CompiledCampaign,
  snap: Snapshot,
  hidden: ReadonlySet<string>,
): FeatureCollection {
  const colors = sideColors(c)
  return fc(
    snap.areas
      .filter((a) => !hidden.has(a.side))
      .map((a): Feature<Polygon | MultiPolygon> => ({
        type: 'Feature',
        properties: {
          id: a.id,
          side: a.side,
          kind: a.kind,
          color: colors.get(a.side) ?? '#666',
          confidence: a.confidence,
        },
        geometry: a.geometry as Polygon | MultiPolygon,
      })),
  )
}
