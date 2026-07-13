/**
 * [INPUT]: 依赖图片自然宽高、画布可见宽度与间距配置
 * [OUTPUT]: 对外提供保持原始尺寸的紧凑自动排版坐标
 * [POS]: renderer/canvas 的纯排版算法，供 engine/useEngineImageEditor 图片导入流程调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function packImages({ items, viewportWidth, gap, origin }) {
  const normalizedItems = items.map((item, index) => ({
    height: Math.max(1, Math.round(item.height)),
    index,
    width: Math.max(1, Math.round(item.width))
  }))
  const totalArea = normalizedItems.reduce((sum, item) => sum + item.width * item.height, 0)
  const widest = normalizedItems.reduce((max, item) => Math.max(max, item.width), 1)
  const targetWidth = Math.max(
    viewportWidth - origin * 2,
    Math.ceil(Math.sqrt(totalArea) * 1.3),
    widest
  )
  const maxX = origin + targetWidth
  const placedItems = []
  const result = new Array(items.length)

  const overlaps = (a, b) =>
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y

  const getY = (candidate) => {
    let y = origin
    let moved = true

    while (moved) {
      moved = false

      for (const placed of placedItems) {
        const next = { ...candidate, y }

        if (overlaps(next, placed)) {
          y = placed.y + placed.height + gap
          moved = true
        }
      }
    }

    return y
  }

  const getCandidates = (width) => {
    const candidates = [origin]

    for (const placed of placedItems) {
      candidates.push(placed.x + placed.width + gap)
    }

    return [...new Set(candidates)].filter((x) => x + width <= maxX).sort((a, b) => a - b)
  }

  const sortedItems = [...normalizedItems].sort((a, b) => {
    const areaDiff = b.width * b.height - a.width * a.height
    if (areaDiff !== 0) return areaDiff
    return Math.max(b.width, b.height) - Math.max(a.width, a.height)
  })

  for (const item of sortedItems) {
    const candidates = getCandidates(item.width)
    let best = null

    for (const x of candidates.length > 0 ? candidates : [origin]) {
      const candidate = { x, y: origin, width: item.width, height: item.height }
      const y = getY(candidate)
      const next = { ...candidate, y }

      if (!best || next.y < best.y || (next.y === best.y && next.x < best.x)) {
        best = next
      }
    }

    placedItems.push(best)
    result[item.index] = best
  }

  return result
}
