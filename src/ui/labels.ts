import type { Confidence, Unit } from '../schema/campaign'

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  documented: '有据可查',
  reconstructed: '据史料还原',
  approximate: '大致',
  conjectural: '推测',
}

export const CONFIDENCE_HINT: Record<Confidence, string> = {
  documented: '有直接史料记载',
  reconstructed: '由史料合理还原',
  approximate: '大致位置或时间',
  conjectural: '有争议或推测',
}

export const UNIT_KIND_LABEL: Record<Unit['kind'], string> = {
  infantry: '步兵',
  cavalry: '骑兵',
  armor: '装甲',
  artillery: '炮兵',
  headquarters: '指挥机关',
  mixed: '混合兵种',
  fleet: '舰队',
  other: '其他',
}

export const EVENT_KIND_LABEL: Record<string, string> = {
  battle: '战斗',
  crossing: '渡河',
  conference: '会议',
  occupation: '占领',
  march: '行军',
  other: '其他',
}
