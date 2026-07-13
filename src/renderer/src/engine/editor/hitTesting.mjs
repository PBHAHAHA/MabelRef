/**
 * [INPUT]: 依赖节点几何（x/y/width/height/scaleX/scaleY/rotation）与世界坐标点/矩形
 * [OUTPUT]: 对外提供 getNodeCorners/getNodeAabb/hitsNode/getTopmostHit/getIdsInRect/normalizeRect，旋转矩形命中与框选判定
 * [POS]: engine/editor 的命中测试纯函数层，无 DOM/GPU 依赖，node 可测，被 editorController 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const DEG_TO_RAD = Math.PI / 180

const getNodeBasis = (node) => {
  const radians = (node.rotation || 0) * DEG_TO_RAD

  return {
    width: (node.width || 1) * (node.scaleX ?? 1),
    height: (node.height || 1) * (node.scaleY ?? 1),
    cos: Math.cos(radians),
    sin: Math.sin(radians)
  }
}

export function getNodeCorners(node) {
  const { width, height, cos, sin } = getNodeBasis(node)
  const x = node.x || 0
  const y = node.y || 0

  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ].map(([lx, ly]) => ({
    x: x + lx * cos - ly * sin,
    y: y + lx * sin + ly * cos
  }))
}

export function getNodeAabb(node) {
  const corners = getNodeCorners(node)
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)

  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY
  }
}

// 逆变换到局部空间判定，旋转矩形与轴对齐矩形走同一条路径
export function hitsNode(node, point) {
  const { width, height, cos, sin } = getNodeBasis(node)
  const dx = point.x - (node.x || 0)
  const dy = point.y - (node.y || 0)
  const localX = dx * cos + dy * sin
  const localY = -dx * sin + dy * cos

  return localX >= 0 && localX <= width && localY >= 0 && localY <= height
}

export function getTopmostHit(nodes, point) {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (hitsNode(nodes[index], point)) return nodes[index]
  }

  return null
}

export function normalizeRect(from, to) {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y)
  }
}

export function getIdsInRect(nodes, rect) {
  return nodes
    .filter((node) => {
      const aabb = getNodeAabb(node)

      return (
        aabb.x < rect.x + rect.width &&
        aabb.x + aabb.width > rect.x &&
        aabb.y < rect.y + rect.height &&
        aabb.y + aabb.height > rect.y
      )
    })
    .map((node) => node.id)
}
