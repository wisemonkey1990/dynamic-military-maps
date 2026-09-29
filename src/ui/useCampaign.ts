import { useEffect, useState } from 'react'
import { Campaign } from '../schema/campaign'

export type CampaignState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; campaign: Campaign }

export function useCampaign(id: string): CampaignState {
  // 结果连同它对应的 id 一起存；id 变了就自然回到 loading，无需在 effect 里同步 setState
  const [result, setResult] = useState<{ id: string; state: CampaignState }>()
  useEffect(() => {
    let cancelled = false
    const done = (state: CampaignState) => {
      if (!cancelled) setResult({ id, state })
    }
    fetch(`${import.meta.env.BASE_URL}data/campaigns/${encodeURIComponent(id)}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? `找不到战役 “${id}”` : `HTTP ${r.status}`)
        return r.json() as Promise<unknown>
      })
      .then((json) => done({ status: 'ready', campaign: Campaign.parse(json) }))
      .catch((e: unknown) =>
        done({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      )
    return () => {
      cancelled = true
    }
  }, [id])
  return result?.id === id ? result.state : { status: 'loading' }
}
