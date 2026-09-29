import { Campaign, type CampaignInput } from '../schema/campaign'

/** 测试用最小战役：A 从 (0,0) 向东行进 1 天到 (1,0)，停留 1 天，再向北 1 天到 (1,1) */
export function makeCampaign(overrides: Partial<CampaignInput> = {}): Campaign {
  return Campaign.parse({
    id: 'test',
    schemaVersion: 1,
    status: 'draft',
    title: '测试战役',
    summary: '测试',
    period: { start: '1935-01-01', end: '1935-01-10' },
    bbox: [-1, -1, 2, 2],
    camera: { center: [0.5, 0.5], zoom: 5 },
    sides: [
      { id: 'a', name: 'A', color: '#cc0000' },
      { id: 'b', name: 'B', color: '#0000cc' },
    ],
    units: [
      {
        id: 'unit-a',
        side: 'a',
        name: 'A 部',
        strength: [
          { t: '1935-01-01', value: 1000 },
          { t: '1935-01-03', value: 800 },
        ],
        track: {
          waypoints: [
            { t: '1935-01-01T00:00', pos: [0, 0], confidence: 'documented' },
            { t: '1935-01-02T00:00', pos: [1, 0], confidence: 'approximate' },
            { t: '1935-01-03T00:00', pos: [1, 0], confidence: 'documented' },
            { t: '1935-01-04T00:00', pos: [1, 1], via: [[1.5, 0.5]], confidence: 'documented' },
          ],
        },
      },
    ],
    events: [{ id: 'ev-1', t: '1935-01-02T06:00', pos: [1, 0], title: '事件一' }],
    arrows: [
      {
        id: 'arrow-1',
        side: 'a',
        from: '1935-01-05',
        to: '1935-01-05',
        path: [
          [0, 0],
          [1, 0],
        ],
      },
    ],
    areas: [
      {
        id: 'area-1',
        side: 'a',
        name: '控制区',
        keyframes: [
          {
            t: '1935-01-02',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
          { t: '1935-01-06', geometry: null },
        ],
      },
    ],
    chapters: [
      { id: 'ch-1', title: '第一章', start: '1935-01-01', end: '1935-01-03', hoursPerSecond: 12 },
      { id: 'ch-2', title: '第二章', start: '1935-01-04', end: '1935-01-10' },
    ],
    ...overrides,
  })
}
