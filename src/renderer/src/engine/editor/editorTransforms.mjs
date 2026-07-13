/**
 * [INPUT]: 依赖 hitTesting 的 getNodeAabb 与世界坐标点
 * [OUTPUT]: 对外提供 getSelectionBounds/getCornerHandles/getHandleAt/getUniformScale/scaleNodePatch/moveNodePatch，选区包围盒与角点等比缩放数学
 * [POS]: engine/editor 的变换纯函数层，等比缩放对旋转节点严格成立（产品语义 lockRatio），node 可测
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getNodeAabb } from './hitTesting.mjs'

const MIN_SCALE = 0.01

// 角点 id → 单位包围盒坐标，anchor 恒为对角: 无任何 per-handle 特殊分支
const CORNERS = [
  { id: 'nw', u: 0, v: 0 },
  { id: 'ne', u: 1, v: 0 },
  { id: 'se', u: 1, v: 1 },
  { id: 'sw', u: 0, v: 1 }
]

export function getSelectionBounds(nodes) {
  if (nodes.length === 0) return null

  const boxes = nodes.map(getNodeAabb)
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function getCornerHandles(bounds) {
  return CORNERS.map(({ id, u, v }) => ({
    id,
    x: bounds.x + u * bounds.width,
    y: bounds.y + v * bounds.height,
    anchor: {
      x: bounds.x + (1 - u) * bounds.width,
      y: bounds.y + (1 - v) * bounds.height
    }
  }))
}

export function getHandleAt(bounds, point, radius) {
  return (
    getCornerHandles(bounds).find(
      (handle) => Math.hypot(handle.x - point.x, handle.y - point.y) <= radius
    ) || null
  )
}

// 等比缩放系数: 指针位移在「手柄-锚点」方向上的投影比，平滑且方向稳定
export function getUniformScale({ handle, point, minScale = MIN_SCALE }) {
  const axisX = handle.x - handle.anchor.x
  const axisY = handle.y - handle.anchor.y
  const axisLengthSq = axisX * axisX + axisY * axisY
  if (axisLengthSq === 0) return 1

  const pointX = point.x - handle.anchor.x
  const pointY = point.y - handle.anchor.y

  return Math.max(minScale, (pointX * axisX + pointY * axisY) / axisLengthSq)
}

// 围绕世界锚点的等比缩放: 旋转不变，scale 直接相乘，无特殊情况
export function scaleNodePatch(node, anchor, scale) {
  return {
    x: anchor.x + ((node.x || 0) - anchor.x) * scale,
    y: anchor.y + ((node.y || 0) - anchor.y) * scale,
    scaleX: (node.scaleX ?? 1) * scale,
    scaleY: (node.scaleY ?? 1) * scale
  }
}

export function moveNodePatch(node, delta) {
  return {
    x: (node.x || 0) + delta.x,
    y: (node.y || 0) + delta.y
  }
}
