/**
 * [INPUT]: 依赖 webgpuRenderer 的 GPU 渲染、instanceLayout 的实例构建，以及主线程转移的 OffscreenCanvas 与 ImageBitmap
 * [OUTPUT]: Web Worker 消息协议——init/resize/addImages/setNodes/setView/start/stop，持续渲染并每 500ms 回报 fps/p95/VRAM 统计
 * [POS]: engine 的渲染线程入口，独占渲染循环，主线程只发送命令，两者通过 postMessage 解耦
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { buildInstanceBuffer, getViewTransform } from './instanceLayout.mjs'
import { createWebGPURenderer } from './webgpuRenderer.mjs'

const STATS_INTERVAL_MS = 500
const FRAME_WINDOW = 240

let renderer = null
let canvas = null
let viewport = { width: 1, height: 1 }
let view = { zoom: 1, x: 0, y: 0 }
let drawItems = []
let running = false
let frameHandle = 0

const textures = new Map()
const frameDeltas = []
let lastFrameAt = 0
let lastStatsAt = 0

const reportStats = (now) => {
  if (now - lastStatsAt < STATS_INTERVAL_MS || frameDeltas.length === 0) return

  const sorted = [...frameDeltas].sort((a, b) => a - b)
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]

  lastStatsAt = now
  postMessage({
    type: 'stats',
    fps: 1000 / average,
    p95Ms: p95,
    frameMs: average,
    vramMB: renderer.getVramBytes() / (1024 * 1024),
    nodeCount: drawItems.length,
    zoom: view.zoom
  })
}

const renderFrame = (now) => {
  if (!running) return

  if (lastFrameAt > 0) {
    frameDeltas.push(now - lastFrameAt)
    if (frameDeltas.length > FRAME_WINDOW) frameDeltas.shift()
  }
  lastFrameAt = now

  renderer.render(getViewTransform({ ...view, ...viewport }), drawItems)
  reportStats(now)
  frameHandle = requestAnimationFrame(renderFrame)
}

const handlers = {
  async init({ canvas: transferredCanvas, width, height, dpr }) {
    canvas = transferredCanvas
    viewport = { width, height }
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    renderer = await createWebGPURenderer(canvas)
    postMessage({ type: 'ready' })
  },

  resize({ width, height, dpr }) {
    viewport = { width, height }
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
  },

  addImages({ images }) {
    for (const image of images) {
      textures.set(
        image.id,
        renderer.createImageTexture(image.bitmap, image.bitmap.width, image.bitmap.height)
      )
      image.bitmap.close()
    }
    postMessage({ type: 'imagesAdded', count: images.length })
  },

  removeImages({ ids }) {
    for (const id of ids) {
      textures.get(id)?.destroy()
      textures.delete(id)
    }
  },

  setNodes({ nodes }) {
    // 先过滤缺纹理节点: 实例缓冲与 drawItems 必须逐下标对齐
    const drawable = nodes.filter((node) => textures.has(node.textureId))

    renderer.setInstances(buildInstanceBuffer(drawable))
    drawItems = drawable.map((node) => textures.get(node.textureId))
  },

  setView(nextView) {
    view = { zoom: nextView.zoom, x: nextView.x, y: nextView.y }
  },

  start() {
    if (running) return
    running = true
    lastFrameAt = 0
    frameHandle = requestAnimationFrame(renderFrame)
  },

  stop() {
    running = false
    cancelAnimationFrame(frameHandle)
    frameDeltas.length = 0
  },

  clear() {
    drawItems = []
    textures.forEach((texture) => texture.destroy())
    textures.clear()
  }
}

// 消息串行化: init 是异步的，后续命令必须排队等它完成，杜绝竞态
let messageQueue = Promise.resolve()

self.addEventListener('message', (event) => {
  const { type, ...payload } = event.data

  messageQueue = messageQueue
    .then(() => handlers[type](payload))
    .catch((error) => {
      postMessage({ type: 'error', message: error?.message || String(error) })
    })
})
