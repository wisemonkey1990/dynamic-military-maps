import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { ZodError } from 'zod'
import { Campaign } from '../src/schema/campaign'
import { validateCampaign, type Issue } from '../src/schema/validate'

export interface LoadedCampaign {
  dir: string
  id: string
  campaign: Campaign | undefined
  issues: Issue[]
}

/** 战役目录下按文件拆分的集合，键名即合并进 Campaign 的字段名 */
const COLLECTIONS = ['units', 'events', 'arrows', 'areas', 'sources'] as const

function readYaml(file: string): unknown {
  return parse(readFileSync(file, 'utf8'))
}

function zodIssues(prefix: string, e: ZodError): Issue[] {
  return e.issues.map((i) => ({
    level: 'error' as const,
    path: [prefix, ...i.path.map(String)].filter(Boolean).join('.'),
    message: i.message,
  }))
}

/**
 * 战役目录布局：
 *   campaign.yaml   元数据、阵营、章节
 *   units.yaml / events.yaml / arrows.yaml / areas.yaml / sources.yaml   各为数组，均可省略
 */
export function loadCampaignDir(dir: string): LoadedCampaign {
  const idFromDir = dir.split('/').filter(Boolean).at(-1) ?? dir
  const metaFile = join(dir, 'campaign.yaml')
  if (!existsSync(metaFile)) {
    return {
      dir,
      id: idFromDir,
      campaign: undefined,
      issues: [{ level: 'error', path: dir, message: '缺少 campaign.yaml' }],
    }
  }
  const raw: Record<string, unknown> = { ...(readYaml(metaFile) as object) }
  for (const key of COLLECTIONS) {
    const file = join(dir, `${key}.yaml`)
    if (existsSync(file)) raw[key] = readYaml(file) ?? []
  }
  const result = Campaign.safeParse(raw)
  if (!result.success) {
    return { dir, id: idFromDir, campaign: undefined, issues: zodIssues('', result.error) }
  }
  const issues: Issue[] = []
  if (result.data.id !== idFromDir) {
    issues.push({
      level: 'error',
      path: 'id',
      message: `id "${result.data.id}" 必须与目录名 "${idFromDir}" 一致`,
    })
  }
  try {
    issues.push(...validateCampaign(result.data))
  } catch (e) {
    issues.push({
      level: 'error',
      path: '(validate)',
      message: e instanceof Error ? e.message : String(e),
    })
  }
  return { dir, id: result.data.id, campaign: result.data, issues }
}

export function loadAllCampaigns(root: string): LoadedCampaign[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadCampaignDir(join(root, d.name)))
}

export function summarize(c: Campaign) {
  return {
    id: c.id,
    status: c.status,
    title: c.title,
    subtitle: c.subtitle,
    period: c.period,
    tags: c.tags,
    counts: { units: c.units.length, events: c.events.length, sources: c.sources.length },
  }
}
