/**
 * 读取 data/campaigns/*，校验，并输出前端可直接加载的 JSON 到 public/data/。
 *   npm run data:build      校验 + 输出
 *   npm run data:validate   只校验（CI 使用）
 * 存在 error 级问题时以非零状态退出。
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadAllCampaigns, summarize } from './loadCampaigns'

const root = resolve(import.meta.dirname, '..')
const checkOnly = process.argv.includes('--check')

const loaded = loadAllCampaigns(join(root, 'data/campaigns'))
let errors = 0
let warnings = 0
for (const l of loaded) {
  for (const i of l.issues) {
    const tag = i.level === 'error' ? '✖' : '⚠'
    console.log(`${tag} [${l.id}] ${i.path}: ${i.message}`)
    if (i.level === 'error') errors++
    else warnings++
  }
}
console.log(`战役 ${loaded.length} 个，错误 ${errors}，警告 ${warnings}`)
if (errors > 0) process.exit(1)

if (!checkOnly) {
  // 原地覆盖，不删除整个目录：开发服务器正在运行时删目录会让它丢失对 public/ 的文件缓存
  const out = join(root, 'public/data')
  const campaignsOut = join(out, 'campaigns')
  mkdirSync(campaignsOut, { recursive: true })
  const index = []
  const keep = new Set<string>()
  for (const l of loaded) {
    if (!l.campaign) continue
    writeFileSync(join(campaignsOut, `${l.id}.json`), JSON.stringify(l.campaign))
    keep.add(`${l.id}.json`)
    index.push(summarize(l.campaign))
  }
  // 只清理已不存在的战役
  if (existsSync(campaignsOut)) {
    for (const f of readdirSync(campaignsOut)) if (!keep.has(f)) rmSync(join(campaignsOut, f))
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index))
  console.log(`已输出 ${index.length} 个战役到 public/data/`)
}
