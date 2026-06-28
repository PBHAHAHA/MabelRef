/**
 * [INPUT]: 依赖画布节点几何数据、视口尺寸和内边距配置
 * [OUTPUT]: 对外提供内容包围盒与适配视口的缩放/居中偏移计算
 * [POS]: renderer/canvas 的纯视口算法，供 Leafer 画布自动缩放居中使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function getContentBounds(nodes) {
  if (nodes.length === 0) return null

  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const maxX = Math.max(...nodes.map((node) => node.x + node.width))
  const maxY = Math.max(...nodes.map((node) => node.y + node.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export function getFitView({ bounds, viewport, padding }) {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return { zoom: 1, position: { x: 0, y: 0 } }
  }

  const availableWidth = Math.max(1, viewport.width - padding * 2)
  const availableHeight = Math.max(1, viewport.height - padding * 2)
  const zoom = Math.min(availableWidth / bounds.width, availableHeight / bounds.height)
  const x = (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom
  const y = (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom

  return {
    zoom: Number(zoom.toFixed(4)),
    position: {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4))
    }
  }
}
