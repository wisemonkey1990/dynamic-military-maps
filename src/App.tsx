import { useEffect, useState } from 'react'
import { formatHistTimeZh, parseHistTime } from './engine'
import { text, type Localized } from './schema/campaign'

interface CampaignSummary {
  id: string
  status: 'draft' | 'reviewed' | 'published'
  title: Localized
  subtitle?: Localized
  period: { start: string; end: string }
  counts: { units: number; events: number; sources: number }
}

const STATUS_LABEL: Record<CampaignSummary['status'], string> = {
  draft: '草稿·待审核',
  reviewed: '已审核',
  published: '已发布',
}

function periodLabel({ start, end }: CampaignSummary['period']): string {
  return `${formatHistTimeZh(parseHistTime(start).start)} — ${formatHistTimeZh(parseHistTime(end).start)}`
}

export function App() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<CampaignSummary[]>
      })
      .then(setCampaigns)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <main className="page">
      <header>
        <h1>战史地图</h1>
        <p className="lead">把历史上真实发生的军事行动，在地图上按时间动态展示出来。</p>
      </header>

      <section aria-labelledby="campaigns-title">
        <h2 id="campaigns-title">战役</h2>
        {error && <p role="alert">战役列表加载失败：{error}</p>}
        {!error && !campaigns && <p>加载中…</p>}
        <ul className="cards">
          {campaigns?.map((c) => (
            <li key={c.id} className="card">
              <span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
              <h3>{text(c.title)}</h3>
              {c.subtitle && <p>{text(c.subtitle)}</p>}
              <p className="meta">
                {periodLabel(c.period)} · {c.counts.units} 支部队 · {c.counts.events} 个事件
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="note">地图播放界面开发中（里程碑 M2）。</p>
    </main>
  )
}
