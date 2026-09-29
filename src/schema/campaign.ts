import { z } from 'zod'
import { HIST_TIME_RE, TIME_PRECISIONS } from '../engine/time'

/** 数据可信度，由高到低。界面：实线 → 虚线 → 点线 */
export const CONFIDENCE_LEVELS = [
  'documented',
  'reconstructed',
  'approximate',
  'conjectural',
] as const
export const Confidence = z.enum(CONFIDENCE_LEVELS)
export type Confidence = z.infer<typeof Confidence>

export const TimePrecision = z.enum(TIME_PRECISIONS)

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '只能使用小写字母、数字和连字符')

/** 文本：直接写中文字符串，或 { zh, en } */
export const Localized = z.union([
  z.string().min(1),
  z.object({ zh: z.string().min(1), en: z.string().min(1).optional() }),
])
export type Localized = z.infer<typeof Localized>

export function text(value: Localized | undefined, lang: 'zh' | 'en' = 'zh'): string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  return (lang === 'en' ? value.en : undefined) ?? value.zh
}

export const HistTime = z
  .string()
  .regex(HIST_TIME_RE, '时间格式应为 YYYY / YYYY-MM / YYYY-MM-DD / YYYY-MM-DDTHH:mm')

export const LngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])

const SourceRefs = z.array(Id).optional()

export const Source = z.object({
  id: Id,
  citation: z.string().min(1),
  url: z.url().optional(),
  kind: z.enum(['primary', 'secondary', 'reference']).default('secondary'),
  /** 该来源内容本身的授权情况，例如 "CC BY-SA 4.0"、"公有领域"、"仅引用事实" */
  license: z.string().optional(),
  note: Localized.optional(),
})
export type Source = z.infer<typeof Source>

export const Side = z.object({
  id: Id,
  name: Localized,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色应为 #RRGGBB'),
  /** 图标/形状标识，阵营不只靠颜色区分 */
  icon: z.enum(['star', 'circle', 'square', 'diamond', 'triangle']).default('circle'),
})
export type Side = z.infer<typeof Side>

export const Waypoint = z.object({
  t: HistTime,
  pos: LngLat,
  /** 从上一路径点到本点途中经过的点（沿道路/河流），按顺序 */
  via: z.array(LngLat).optional(),
  precision: TimePrecision.optional(),
  confidence: Confidence.default('documented'),
  place: Localized.optional(),
  note: Localized.optional(),
  sources: SourceRefs,
})
export type Waypoint = z.infer<typeof Waypoint>

export const UNIT_KINDS = [
  'infantry',
  'cavalry',
  'armor',
  'artillery',
  'headquarters',
  'mixed',
  'fleet',
  'other',
] as const

export const Unit = z.object({
  id: Id,
  side: Id,
  name: Localized,
  kind: z.enum(UNIT_KINDS).default('infantry'),
  /** 编制层级，自由文本：师、军团、纵队…… */
  echelon: z.string().optional(),
  commander: Localized.optional(),
  description: Localized.optional(),
  strength: z
    .array(
      z.object({
        t: HistTime,
        value: z.number().positive(),
        confidence: Confidence.default('approximate'),
        sources: SourceRefs,
      }),
    )
    .optional(),
  track: z.object({ waypoints: z.array(Waypoint).min(1) }),
  /**
   * 部队在图上可见的时间窗口。缺省：从首个路径点起一直可见到战役结束。
   * 只有零星记载的部队（如某次战斗中的对手）用它限定出现时段，避免编造窗口之外的位置。
   * to 按其精度取区间末尾（"1935-01-29" 即含 29 日全天）。
   */
  lifespan: z.object({ from: HistTime.optional(), to: HistTime.optional() }).optional(),
  sources: SourceRefs,
})
export type Unit = z.infer<typeof Unit>

export const EVENT_KINDS = [
  'battle',
  'crossing',
  'conference',
  'occupation',
  'march',
  'other',
] as const

export const HistEvent = z.object({
  id: Id,
  t: HistTime,
  /** 事件持续到何时；缺省则按引擎的默认停留时长处理 */
  until: HistTime.optional(),
  precision: TimePrecision.optional(),
  pos: LngLat,
  kind: z.enum(EVENT_KINDS).default('other'),
  title: Localized,
  body: Localized.optional(),
  units: z.array(Id).optional(),
  confidence: Confidence.default('documented'),
  sources: SourceRefs,
})
export type HistEvent = z.infer<typeof HistEvent>

export const ARROW_KINDS = ['advance', 'retreat', 'maneuver', 'feint'] as const

export const Arrow = z.object({
  id: Id,
  side: Id,
  kind: z.enum(ARROW_KINDS).default('advance'),
  from: HistTime,
  to: HistTime,
  path: z.array(LngLat).min(2),
  label: Localized.optional(),
  confidence: Confidence.default('approximate'),
  sources: SourceRefs,
})
export type Arrow = z.infer<typeof Arrow>

const AreaGeometry = z.object({
  type: z.enum(['Polygon', 'MultiPolygon']),
  coordinates: z.array(z.any()),
})

export const AREA_KINDS = ['control', 'encirclement', 'operations'] as const

export const Area = z.object({
  id: Id,
  side: Id,
  kind: z.enum(AREA_KINDS).default('control'),
  name: Localized,
  confidence: Confidence.default('approximate'),
  /** 按时间排序的快照，相邻快照之间阶跃切换；geometry 为 null 表示该区域消失 */
  keyframes: z.array(z.object({ t: HistTime, geometry: AreaGeometry.nullable() })).min(1),
  sources: SourceRefs,
})
export type Area = z.infer<typeof Area>

export const Chapter = z.object({
  id: Id,
  title: Localized,
  start: HistTime,
  end: HistTime,
  /** 本章播放速度：每真实秒经过的历史小时数（1× 时）；缺省用战役默认值 */
  hoursPerSecond: z.number().positive().optional(),
  narration: Localized.optional(),
  camera: z
    .object({
      center: LngLat,
      zoom: z.number().min(0).max(22),
      bearing: z.number().optional(),
      pitch: z.number().optional(),
    })
    .optional(),
})
export type Chapter = z.infer<typeof Chapter>

export const CAMPAIGN_STATUS = ['draft', 'reviewed', 'published'] as const

export const CampaignMeta = z.object({
  id: Id,
  schemaVersion: z.literal(1),
  /** draft 草稿（待审核）→ reviewed 已审核 → published 已发布。已发布的数据缺来源即报错 */
  status: z.enum(CAMPAIGN_STATUS),
  title: Localized,
  subtitle: Localized.optional(),
  summary: Localized,
  period: z.object({ start: HistTime, end: HistTime }),
  /** 战场范围 [西, 南, 东, 北]，用于校验坐标与初始视野 */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  defaultHoursPerSecond: z.number().positive().default(24),
  camera: z.object({ center: LngLat, zoom: z.number().min(0).max(22) }),
  sides: z.array(Side).min(1),
  chapters: z.array(Chapter).default([]),
  tags: z.array(z.string()).optional(),
})

export const Campaign = CampaignMeta.extend({
  units: z.array(Unit).default([]),
  events: z.array(HistEvent).default([]),
  arrows: z.array(Arrow).default([]),
  areas: z.array(Area).default([]),
  sources: z.array(Source).default([]),
})
export type Campaign = z.infer<typeof Campaign>
export type CampaignInput = z.input<typeof Campaign>
