import type { Campaign } from '../schema/campaign'
import { text } from '../schema/campaign'
import { CONFIDENCE_HINT, CONFIDENCE_LABEL } from './labels'

const DASH: Record<string, string | undefined> = {
  documented: undefined,
  reconstructed: undefined,
  approximate: '6 4',
  conjectural: '1 5',
}

export function Legend({ campaign }: { campaign: Campaign }) {
  return (
    <details className="legend">
      <summary>图例</summary>
      <h4>线型 = 数据可信度</h4>
      <ul>
        {(Object.keys(CONFIDENCE_LABEL) as (keyof typeof CONFIDENCE_LABEL)[]).map((k) => (
          <li key={k}>
            <svg width="44" height="10" aria-hidden="true">
              <line
                x1="2"
                y1="5"
                x2="42"
                y2="5"
                stroke="currentColor"
                strokeWidth={k === 'reconstructed' ? 2 : 3}
                strokeLinecap="round"
                strokeDasharray={DASH[k]}
              />
            </svg>
            <span>
              {CONFIDENCE_LABEL[k]}
              <small>{CONFIDENCE_HINT[k]}</small>
            </span>
          </li>
        ))}
      </ul>
      <h4>阵营</h4>
      <ul>
        {campaign.sides.map((s) => (
          <li key={s.id}>
            <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
            <span>{text(s.name)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
