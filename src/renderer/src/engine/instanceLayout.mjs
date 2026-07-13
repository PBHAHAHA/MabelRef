/**
 * [INPUT]: 依赖图片节点几何（位置/尺寸/缩放/旋转/透明度/灰度）与视口状态（zoom/pan/画布 CSS 尺寸）
 * [OUTPUT]: 对外提供 INSTANCE_FLOATS/writeInstance/getViewTransform，把节点写入 GPU 实例缓冲并计算 world→clip 视口变换
 * [POS]: engine 的实例数据纯函数层，被 renderWorker 消费，无任何 GPU/DOM 依赖，node 可测
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// 每实例 3 个 vec4: [a,b,c,d] 旋转缩放 | [tx,ty,opacity,gray] | [u0,v0,u1,v1]
export const INSTANCE_FLOATS = 12

const DEG_TO_RAD = Math.PI / 180

export function writeInstance(target, index, node) {
  const width = (node.width || 1) * (node.scaleX ?? 1)
  const height = (node.height || 1) * (node.scaleY ?? 1)
  const radians = (node.rotation || 0) * DEG_TO_RAD
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const uv = node.uv || [0, 0, 1, 1]
  const offset = index * INSTANCE_FLOATS

  target[offset] = cos * width
  target[offset + 1] = sin * width
  target[offset + 2] = -sin * height
  target[offset + 3] = cos * height
  target[offset + 4] = node.x || 0
  target[offset + 5] = node.y || 0
  target[offset + 6] = node.opacity ?? 1
  target[offset + 7] = node.grayscale || 0
  target[offset + 8] = uv[0]
  target[offset + 9] = uv[1]
  target[offset + 10] = uv[2]
  target[offset + 11] = uv[3]

  return target
}

export function buildInstanceBuffer(nodes) {
  const buffer = new Float32Array(Math.max(1, nodes.length) * INSTANCE_FLOATS)

  nodes.forEach((node, index) => writeInstance(buffer, index, node))
  return buffer
}

// world→clip: clip = world * scale + offset，Y 轴翻转烘焙进 scale
export function getViewTransform({ zoom, x, y, width, height }) {
  const safeZoom = zoom || 1

  return [
    (2 * safeZoom) / width,
    (-2 * safeZoom) / height,
    (2 * (x || 0)) / width - 1,
    1 - (2 * (y || 0)) / height
  ]
}
