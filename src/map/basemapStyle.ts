import { layers, namedFlavor } from '@protomaps/basemaps'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

/** 自托管的川黔滇区域切片（脚本：scripts/basemap/extract.py），随站点一起部署 */
export function basemapUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}tiles/basemap.pmtiles`, window.location.href).href
}

const RIVER_KINDS = ['river', 'canal']

/**
 * 底图只作“地形参照”：调成偏淡的纸色，去掉所有文字与图标图层
 * （地名由我们自己按史料叠加，避免今名与史实混淆，也无需字体文件）。
 */
export function buildBasemapStyle(): StyleSpecification {
  const flavor = {
    ...namedFlavor('light'),
    background: '#efe9da',
    earth: '#efe9da',
    water: '#a9c8dc',
    wood_a: '#dbe3c8',
    wood_b: '#c8d8b4',
    park_a: '#dbe3c8',
    park_b: '#c8d8b4',
    boundaries: '#a08c78',
    minor_a: '#e6dfcf',
    minor_b: '#ece6d8',
    major: '#f7f2e6',
    highway: '#f7f2e6',
    major_casing_early: '#d8cfba',
    highway_casing_early: '#d8cfba',
    major_casing_late: '#d8cfba',
    highway_casing_late: '#d8cfba',
    landcover: {
      forest: 'rgba(205, 219, 186, 1)',
      farmland: 'rgba(226, 228, 200, 1)',
      grassland: 'rgba(222, 228, 196, 1)',
      scrub: 'rgba(224, 226, 196, 1)',
      barren: 'rgba(238, 230, 208, 1)',
      urban_area: 'rgba(228, 222, 210, 1)',
      glacier: 'rgba(255, 255, 255, 1)',
    },
  }
  const base = layers('basemap', flavor, { lang: 'zh' }).filter(
    (l) => l.type !== 'symbol' && l.id !== 'buildings',
  ) as LayerSpecification[]

  // 河流是“水”图层里的线要素，默认样式只画了水面多边形
  const rivers: LayerSpecification = {
    id: 'water-lines',
    type: 'line',
    source: 'basemap',
    'source-layer': 'water',
    filter: [
      'all',
      ['==', ['geometry-type'], 'LineString'],
      ['in', ['get', 'kind'], ['literal', RIVER_KINDS]],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': flavor.water,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 8, 1.3, 10, 2.2, 12, 4],
    },
  }
  const waterIdx = base.findIndex((l) => l.id === 'water')
  base.splice(waterIdx + 1, 0, rivers)

  return {
    version: 8,
    sources: {
      basemap: {
        type: 'vector',
        url: `pmtiles://${basemapUrl()}`,
        attribution:
          '<a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a> © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
    },
    layers: base,
  }
}
