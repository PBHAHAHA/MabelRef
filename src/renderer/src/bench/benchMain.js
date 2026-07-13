/**
 * [INPUT]: 依赖 engine/engineClient 门面、engine/editor 的 sceneStore/editorController/selectionOverlay、benchScene 场景纯函数与 benchTextures 程序化纹理
 * [OUTPUT]: 压测页入口——生成 N 张程序化大图上传 GPU，先跑振荡缩放动画量帧率，任意指针交互接管为编辑模式（选择/框选/拖拽/缩放/删除）
 * [POS]: bench 的浏览器入口，M1 渲染核与 M2 交互层的共同验收现场，独立于主应用 Vue 壳
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createEngineClient } from '../engine/engineClient.mjs'
import { createEditorController } from '../engine/editor/editorController.mjs'
import { createSceneStore } from '../engine/editor/sceneStore.mjs'
import { createSelectionOverlay } from '../engine/editor/selectionOverlay.mjs'
import { createBenchSpecs, getBenchBounds, getBenchView, layoutBenchNodes } from './benchScene.mjs'
import { createBenchBitmap } from './benchTextures.mjs'

const UPLOAD_CHUNK = 16

const canvas = document.getElementById('bench-canvas')
const overlayCanvas = document.getElementById('bench-overlay')
const canvasWrap = document.getElementById('bench-canvas-wrap')
const runButton = document.getElementById('bench-run')
const countSelect = document.getElementById('bench-count')
const edgeSelect = document.getElementById('bench-edge')
const statusText = document.getElementById('bench-status')
const statsText = document.getElementById('bench-stats')
const errorOverlay = document.getElementById('bench-error')

const store = createSceneStore()
const overlay = createSelectionOverlay(overlayCanvas)

let engine = null
let controller = null
let view = { zoom: 1, x: 0, y: 0 }
let animationHandle = 0
let animating = false
let benchStartedAt = 0
let benchBounds = null

const showError = (message) => {
  errorOverlay.textContent = message
  errorOverlay.style.display = 'grid'
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const formatStats = (stats) =>
  [
    `fps ${stats.fps.toFixed(0)}`,
    `p95 ${stats.p95Ms.toFixed(1)}ms`,
    `vram ${stats.vramMB.toFixed(0)}MB`,
    `nodes ${stats.nodeCount}`,
    `zoom ${stats.zoom.toFixed(2)}x`
  ].join('  ')

const drawOverlay = () => {
  overlay.draw({
    view,
    selectedNodes: store.getSelectedNodes(),
    marquee: controller?.getMarquee() || null
  })
}

const applyView = (nextView) => {
  view = nextView
  engine.setView(view)
  drawOverlay()
}

const stopAnimation = () => {
  if (!animating) return

  animating = false
  cancelAnimationFrame(animationHandle)
  statusText.textContent = '交互模式 · 点选/Shift 多选/框选/角点缩放/Delete 删除/中键平移'
}

const animate = () => {
  if (!animating) return

  const rect = canvas.getBoundingClientRect()

  applyView(
    getBenchView({
      elapsedMs: performance.now() - benchStartedAt,
      bounds: benchBounds,
      viewport: { width: rect.width, height: rect.height }
    })
  )
  animationHandle = requestAnimationFrame(animate)
}

async function runBench() {
  const count = Number(countSelect.value)
  const maxEdge = Number(edgeSelect.value)

  runButton.disabled = true
  stopAnimation()
  engine.stop()
  engine.clear()
  store.setNodes([])
  store.setSelection([])

  const specs = createBenchSpecs({ count, maxEdge, minEdge: Math.round(maxEdge / 4) })
  const uploadStart = performance.now()

  for (let offset = 0; offset < specs.length; offset += UPLOAD_CHUNK) {
    const chunk = specs.slice(offset, offset + UPLOAD_CHUNK)

    engine.addImages(chunk.map((spec) => ({ id: spec.id, bitmap: createBenchBitmap(spec) })))
    statusText.textContent = `生成纹理 ${Math.min(offset + UPLOAD_CHUNK, specs.length)}/${specs.length}`
    await nextFrame()
  }

  const uploadMs = performance.now() - uploadStart

  store.setNodes(layoutBenchNodes(specs))
  benchBounds = getBenchBounds(store.getNodes())
  benchStartedAt = performance.now()
  engine.start()
  animating = true
  animate()
  statusText.textContent = `动画压测中（任意点击进入交互）· ${count} 图上传 ${(uploadMs / 1000).toFixed(1)}s`
  runButton.disabled = false
}

async function main() {
  if (!navigator.gpu) {
    showError('这个环境没有 WebGPU。请确认 Electron/Chromium 版本或显卡驱动。')
    return
  }

  engine = createEngineClient(canvas, {
    onStats: (stats) => {
      statsText.textContent = formatStats(stats)
    },
    onError: (error) => showError(`渲染线程错误: ${error.message}`)
  })

  try {
    await engine.ready()
  } catch (error) {
    showError(`WebGPU 初始化失败: ${error.message}`)
    return
  }

  store.subscribe(() => {
    engine.setNodes(store.getNodes())
    drawOverlay()
  })

  controller = createEditorController({
    element: canvasWrap,
    store,
    getView: () => view,
    setView: (nextView) => {
      stopAnimation()
      applyView(nextView)
    },
    onOverlayChange: drawOverlay
  })
  canvasWrap.addEventListener('pointerdown', stopAnimation, { capture: true })

  const rect = canvas.getBoundingClientRect()

  overlay.resize(rect.width, rect.height, devicePixelRatio)
  new ResizeObserver(() => {
    const nextRect = canvas.getBoundingClientRect()

    engine.resize(nextRect.width, nextRect.height)
    overlay.resize(nextRect.width, nextRect.height, devicePixelRatio)
    drawOverlay()
  }).observe(canvas)

  statusText.textContent = 'WebGPU 就绪'
  runButton.addEventListener('click', () => {
    runBench().catch((error) => showError(error.message))
  })
}

main()
