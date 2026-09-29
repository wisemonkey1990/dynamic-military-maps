import { lazy, Suspense, useEffect, useState } from 'react'
import { formatHistTimeZh, parseHistTime } from './engine'
import { text, type Localized } from './schema/campaign'
import { useCampaign } from './ui/useCampaign'

// 地图页连同 MapLibre 一起按需加载，首页不必下载 1MB+ 的地图代码
const CampaignPage = lazy(() =>
  import('./ui/CampaignPage').then((m) => ({ default: m.CampaignPage })),
)

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

/** hash 路由：#/ 首页；#/c/<战役id>?t=<历史时间> 战役页。静态托管下刷新不会 404 */
function useRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?')
  const m = /^\/c\/([^/]+)\/?$/.exec(path)
  return {
    campaignId: m?.[1] ? decodeURIComponent(m[1]) : undefined,
    params: new URLSearchParams(query),
  }
}

export function App() {
  const { campaignId, params } = useRoute()
  if (campaignId) return <CampaignRoute id={campaignId} params={params} />
  return <Home />
}

function CampaignRoute({ id, params }: { id: string; params: URLSearchParams }) {
  const state = useCampaign(id)
  if (state.status === 'loading') return <p className="page">加载中…</p>
  if (state.status === 'error') {
    return (
      <main className="page">
        <p role="alert">战役加载失败：{state.message}</p>
        <a href="#/">← 返回战役列表</a>
      </main>
    )
  }
  return (
    <Suspense fallback={<p className="page">加载地图…</p>}>
      <CampaignPage key={state.campaign.id} campaign={state.campaign} params={params} />
    </Suspense>
  )
}

function Home() {
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
            <li key={c.id}>
              <a className="card" href={`#/c/${c.id}`}>
                <span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                <h3>{text(c.title)}</h3>
                {c.subtitle && <p>{text(c.subtitle)}</p>}
                <p className="meta">
                  {periodLabel(c.period)} · {c.counts.units} 支部队 · {c.counts.events} 个事件
                </p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
