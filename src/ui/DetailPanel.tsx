import { formatHistTimeZh, parseHistTime, unitContext, type CompiledCampaign } from '../engine'
import type { Selection } from '../map/MapView'
import { text } from '../schema/campaign'
import { CONFIDENCE_HINT, CONFIDENCE_LABEL, EVENT_KIND_LABEL, UNIT_KIND_LABEL } from './labels'
import { SourceList } from './SourceList'

interface Props {
  compiled: CompiledCampaign
  t: number
  selected: Selection
  onClose: () => void
  onSelect: (s: Selection) => void
}

function Confidence({ level }: { level: keyof typeof CONFIDENCE_LABEL }) {
  return (
    <span className={`conf-badge conf-${level}`} title={CONFIDENCE_HINT[level]}>
      {CONFIDENCE_LABEL[level]}
    </span>
  )
}

export function DetailPanel({ compiled, t, selected, onClose, onSelect }: Props) {
  const campaign = compiled.campaign
  const body = (() => {
    if (selected.type === 'unit') {
      const unit = campaign.units.find((u) => u.id === selected.id)
      if (!unit) return null
      const side = campaign.sides.find((s) => s.id === unit.side)
      const ctx = unitContext(compiled, unit.id, t)
      const ids = [...(unit.sources ?? []), ...(ctx?.prev?.sources ?? [])]
      return (
        <>
          <h2>{text(unit.name)}</h2>
          <p className="muted">
            {side && text(side.name)} · {UNIT_KIND_LABEL[unit.kind]}
            {unit.echelon ? ` · ${unit.echelon}` : ''}
          </p>
          {unit.commander && <p>指挥：{text(unit.commander)}</p>}
          {unit.description && <p>{text(unit.description)}</p>}
          {ctx?.prev && (
            <section>
              <h3>
                当前所在 <Confidence level={ctx.prev.confidence} />
              </h3>
              <p>
                {ctx.prev.place ? text(ctx.prev.place) : '—'}
                <span className="muted">
                  {' '}
                  ·{' '}
                  {formatHistTimeZh(
                    parseHistTime(ctx.prev.t, ctx.prev.precision).start,
                    parseHistTime(ctx.prev.t, ctx.prev.precision).precision,
                  )}
                </span>
              </p>
              {ctx.prev.note && <p>{text(ctx.prev.note)}</p>}
            </section>
          )}
          {ctx?.next && (
            <section>
              <h3>接下来</h3>
              <p>
                {ctx.next.place ? text(ctx.next.place) : '—'}
                <span className="muted">
                  {' '}
                  ·{' '}
                  {formatHistTimeZh(
                    parseHistTime(ctx.next.t, ctx.next.precision).start,
                    parseHistTime(ctx.next.t, ctx.next.precision).precision,
                  )}
                </span>
              </p>
            </section>
          )}
          <section>
            <h3>来源</h3>
            <SourceList ids={ids} campaign={campaign} />
          </section>
        </>
      )
    }
    const ev = campaign.events.find((e) => e.id === selected.id)
    if (!ev) return null
    const span = parseHistTime(ev.t, ev.precision)
    return (
      <>
        <h2>{text(ev.title)}</h2>
        <p className="muted">
          {EVENT_KIND_LABEL[ev.kind] ?? ev.kind} · {formatHistTimeZh(span.start, span.precision)}{' '}
          <Confidence level={ev.confidence} />
        </p>
        {ev.body && <p>{text(ev.body)}</p>}
        {ev.units && ev.units.length > 0 && (
          <section>
            <h3>相关部队</h3>
            <ul className="chips">
              {ev.units.map((id) => {
                const u = campaign.units.find((x) => x.id === id)
                return (
                  <li key={id}>
                    <button type="button" onClick={() => onSelect({ type: 'unit', id })}>
                      {u ? text(u.name) : id}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        <section>
          <h3>来源</h3>
          <SourceList ids={ev.sources ?? []} campaign={campaign} />
        </section>
      </>
    )
  })()

  return (
    <aside className="detail" aria-label="详情">
      <button type="button" className="close" onClick={onClose} aria-label="关闭详情">
        ×
      </button>
      {body}
      {campaign.status === 'draft' && <p className="draft-note">本条数据为草稿，尚未审核。</p>}
    </aside>
  )
}
