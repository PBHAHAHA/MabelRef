/**
 * [INPUT]: 依赖视口点、当前树位置、缩放值与滚轮 delta
 * [OUTPUT]: 对外提供 getAnchoredZoomView/getWheelZoomFactor/getPannedView，计算以指针为锚点的画布缩放视图、细步进滚轮缩放因子与平移视图
 * [POS]: renderer/canvas 的视口缩放纯函数，被 engine/useEngineImageEditor 与 engine/editor/editorController 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const WHEEL_ZOOM_SENSITIVITY = 0.0045
const MIN_WHEEL_FACTOR = 0.65
const MAX_WHEEL_FACTOR = 1.5

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export function getAnchoredZoomView({ anchor, currentPosition, currentZoom, nextZoom }) {
  const safeCurrentZoom = currentZoom || 1
  const canvasPoint = {
    x: (anchor.x - currentPosition.x) / safeCurrentZoom,
    y: (anchor.y - currentPosition.y) / safeCurrentZoom
  }

  return {
    nextZoom,
    position: {
      x: anchor.x - canvasPoint.x * nextZoom,
      y: anchor.y - canvasPoint.y * nextZoom
    }
  }
}

export function getWheelZoomFactor(deltaY) {
  return Number(clamp(1 - deltaY * WHEEL_ZOOM_SENSITIVITY, MIN_WHEEL_FACTOR, MAX_WHEEL_FACTOR).toFixed(4))
}

export function getPannedView({ currentPosition, delta }) {
  return {
    position: {
      x: currentPosition.x - delta.x,
      y: currentPosition.y - delta.y
    }
  }
}
