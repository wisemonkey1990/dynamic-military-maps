export interface ScreenPoint {
  id: string
  x: number
  y: number
}

/**
 * 屏幕上挤在一起的标记（如同处一地的几个军团）沿小圆均匀散开，
 * 返回每个 id 的像素偏移 [dx, dy]。距离超过 minDist 的点不动。
 */
export function spreadOffsets(
  points: readonly ScreenPoint[],
  minDist = 26,
): Map<string, [number, number]> {
  const clusters: ScreenPoint[][] = []
  for (const p of points) {
    const home = clusters.find((cl) => Math.hypot(cl[0]!.x - p.x, cl[0]!.y - p.y) < minDist)
    if (home) home.push(p)
    else clusters.push([p])
  }
  const out = new Map<string, [number, number]>()
  for (const cl of clusters) {
    const n = cl.length
    if (n === 1) {
      out.set(cl[0]!.id, [0, 0])
      continue
    }
    const r = n === 2 ? 15 : 13 + 3 * n
    cl.forEach((p, k) => {
      const a = (2 * Math.PI * k) / n - Math.PI / 2
      out.set(p.id, [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)])
    })
  }
  return out
}
