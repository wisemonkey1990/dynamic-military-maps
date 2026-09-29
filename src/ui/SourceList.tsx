import { text, type Campaign } from '../schema/campaign'

export function SourceList({ ids, campaign }: { ids: readonly string[]; campaign: Campaign }) {
  const uniq = [...new Set(ids)]
  const items = uniq.flatMap((id) => campaign.sources.find((s) => s.id === id) ?? [])
  if (items.length === 0) return <p className="muted">暂无登记来源。</p>
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
