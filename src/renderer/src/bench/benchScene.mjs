/**
 * [INPUT]: 依赖 canvas/viewportFit 的 getContentBounds/getFitView，自带确定性伪随机数
 * [OUTPUT]: 对外提供 createBenchSpecs/layoutBenchNodes/getBenchView，生成确定性压测图集、O(n) 货架排版与随时间振荡的缩放视口
 * [POS]: bench 的场景纯函数层，无 DOM/GPU 依赖，node 可测，被 benchMain 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getContentBounds, getFitView } from '../canvas/viewportFit.mjs'

const TWO_PI = Math.PI * 2

// mulberry32: 确定性伪随机，保证每次压测场景一致、结果可对比
const createRandom = (seed) => {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createBenchSpecs({ count, seed = 7, minEdge = 512, maxEdge = 2048 }) {
  const random = createRandom(seed)

  return Array.from({ length: count }, (_, index) => {
    const width = Math.round(minEdge + random() * (maxEdge - minEdge))
    const aspect = 0.6 + random() * 1.2
    const height = Math.round(Math.min(maxEdge, Math.max(minEdge, width * aspect)))

    return {
      id: `bench-${index}`,
      width,
      height,
      hue: Math.round(random() * 360),
      label: String(index)
    }
  })
}

// 货架排版: 左到右填行，行满换行，O(n)，千图毫秒级
export function layoutBenchNodes(specs, { gap = 24 } = {}) {
  const totalArea = specs.reduce((sum, spec) => sum + spec.width * spec.height, 0)
  const targetWidth = Math.ceil(Math.sqrt(totalArea) * 1.25)
  const nodes = []
  let x = 0
  let y = 0
  let rowHeight = 0

  for (const spec of specs) {
    if (x > 0 && x + spec.width > targetWidth) {
      x = 0
      y += rowHeight + gap
      rowHeight = 0
    }

    nodes.push({ id: spec.id, textureId: spec.id, x, y, width: spec.width, height: spec.height })
    x += spec.width + gap
    rowHeight = Math.max(rowHeight, spec.height)
  }

  return nodes
}

// 缩放在 fit/8 与 fit*8 之间按正弦振荡，中心同时缓慢漂移——Canvas 2D 的最坏情况
export function getBenchView({
  elapsedMs,
  bounds,
  viewport,
  padding = 60,
  zoomPeriodMs = 8000,
  zoomSpan = 3
}) {
  const fit = getFitView({ bounds, viewport, padding })
  const zoom = fit.zoom * Math.pow(2, Math.sin((TWO_PI * elapsedMs) / zoomPeriodMs) * zoomSpan)
  const centerX =
    bounds.x + bounds.width / 2 + Math.sin((TWO_PI * elapsedMs) / 11000) * bounds.width * 0.2
  const centerY =
    bounds.y + bounds.height / 2 + Math.cos((TWO_PI * elapsedMs) / 13000) * bounds.height * 0.2

  return {
    zoom,
    x: viewport.width / 2 - centerX * zoom,
    y: viewport.height / 2 - centerY * zoom
  }
}

export function getBenchBounds(nodes) {
  return getContentBounds(nodes)
}
