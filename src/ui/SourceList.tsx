import { text, type Campaign, type Source } from '../schema/campaign'

/** 约定：id 以 geo- 开头的来源是“坐标出处”，与史料来源分开显示 */
const isGeoSource = (id: string) => id.startsWith('geo-')

function Items({ items }: { items: Source[] }) {
  return (
    <ol className="sources">
      {items.map((s) => (
        <li key={s.id}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.citation}
            </a>
          ) : (
            s.citation
          )}
          {s.note && <div className="muted">{text(s.note)}</div>}
        </li>
      ))}
    </ol>
  )
}

export function SourceList({ ids, campaign }: { ids: readonly string[]; campaign: Campaign }) {
  const items = [...new Set(ids)].flatMap((id) => campaign.sources.find((s) => s.id === id) ?? [])
  const main = items.filter((s) => !isGeoSource(s.id))
  const geo = items.filter((s) => isGeoSource(s.id))
  if (items.length === 0) return <p className="muted">暂无登记来源。</p>
  return (
    <>
      {main.length > 0 ? <Items items={main} /> : <p className="muted">暂无史料来源。</p>}
      {geo.length > 0 && (
        <details className="geo-sources">
          <summary>坐标来源（{geo.length}）</summary>
          <Items items={geo} />
        </details>
      )}
    </>
  )
}
