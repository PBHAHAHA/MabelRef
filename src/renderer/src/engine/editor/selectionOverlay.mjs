/**
 * [INPUT]: 依赖 hitTesting 的 getNodeCorners、editorTransforms 的 getSelectionBounds/getCornerHandles 与 2D canvas
 * [OUTPUT]: 对外提供 createSelectionOverlay，在主线程覆盖层绘制选中轮廓、选区包围盒、角点手柄与框选矩形
 * [POS]: engine/editor 的选区可视化，纯 UI 装饰层，与 GPU 画布内容分离，每帧成本可忽略
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getNodeCorners } from './hitTesting.mjs'
import {
  getCornerHandles,
  getEdgeHandles,
  getRotationHandle,
  ROTATION_HANDLE_DISTANCE_PX,
  getSelectionBounds
} from './editorTransforms.mjs'

const ACCENT = '#4f8cff'
const HANDLE_SIZE = 8

export function createSelectionOverlay(canvas) {
  const ctx = canvas.getContext('2d')
  let dpr = 1

  const toScreen = (view, point) => ({
    x: point.x * view.zoom + view.x,
    y: point.y * view.zoom + view.y
  })

  return {
    resize(width, height, devicePixelRatio) {
      dpr = devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
    },

    draw({ view, selectedNodes, marquee }) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

      for (const node of selectedNodes) {
        const corners = node ? getNodeCorners(node).map((point) => toScreen(view, point)) : []

        ctx.strokeStyle = ACCENT
        ctx.lineWidth = 1.5
        ctx.beginPath()
        corners.forEach((point, index) =>
          index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)
        )
        ctx.closePath()
        ctx.stroke()
      }

      const bounds = getSelectionBounds(selectedNodes)

      if (bounds) {
        const topLeft = toScreen(view, bounds)

        ctx.strokeStyle = ACCENT
        ctx.lineWidth = 1
        ctx.strokeRect(topLeft.x, topLeft.y, bounds.width * view.zoom, bounds.height * view.zoom)

        const rotationHandle = getRotationHandle(bounds, ROTATION_HANDLE_DISTANCE_PX / view.zoom)
        const rotationPoint = toScreen(view, rotationHandle)
        const rotationCenterTop = toScreen(view, {
          x: bounds.x + bounds.width / 2,
          y: bounds.y
        })

        ctx.beginPath()
        ctx.moveTo(rotationCenterTop.x, rotationCenterTop.y)
        ctx.lineTo(rotationPoint.x, rotationPoint.y)
        ctx.stroke()

        for (const handle of [...getCornerHandles(bounds), ...getEdgeHandles(bounds)]) {
          const point = toScreen(view, handle)

          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = ACCENT
          ctx.fillRect(
            point.x - HANDLE_SIZE / 2,
            point.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          )
          ctx.strokeRect(
            point.x - HANDLE_SIZE / 2,
            point.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          )
        }

        ctx.beginPath()
        ctx.arc(rotationPoint.x, rotationPoint.y, HANDLE_SIZE / 2, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = ACCENT
        ctx.fill()
        ctx.stroke()
      }

      if (marquee) {
        const topLeft = toScreen(view, marquee)

        ctx.fillStyle = 'rgba(79, 140, 255, 0.12)'
        ctx.strokeStyle = ACCENT
        ctx.lineWidth = 1
        ctx.fillRect(topLeft.x, topLeft.y, marquee.width * view.zoom, marquee.height * view.zoom)
        ctx.strokeRect(topLeft.x, topLeft.y, marquee.width * view.zoom, marquee.height * view.zoom)
      }
    }
  }
}
