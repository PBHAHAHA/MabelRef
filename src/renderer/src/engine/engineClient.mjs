/**
 * [INPUT]: 依赖 renderWorker（Vite module worker）、DOM canvas 的 transferControlToOffscreen 与 ImageBitmap 转移
 * [OUTPUT]: 对外提供 createEngineClient——主线程渲染引擎门面，封装 Worker 生命周期、命令发送与 stats/error 回调
 * [POS]: engine 的主线程接入点，Vue/bench 页面只与它对话，不直接接触 Worker 协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export function createEngineClient(canvasElement, { onStats, onError } = {}) {
  const worker = new Worker(new URL('./renderWorker.mjs', import.meta.url), { type: 'module' })
  const offscreen = canvasElement.transferControlToOffscreen()
  const readyPromise = new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      if (event.data.type === 'ready') {
        worker.removeEventListener('message', handleMessage)
        resolve()
      }
      if (event.data.type === 'error') {
        worker.removeEventListener('message', handleMessage)
        reject(new Error(event.data.message))
      }
    }

    worker.addEventListener('message', handleMessage)
  })

  worker.addEventListener('message', (event) => {
    if (event.data.type === 'stats') onStats?.(event.data)
    if (event.data.type === 'error') onError?.(new Error(event.data.message))
  })

  const rect = canvasElement.getBoundingClientRect()

  worker.postMessage(
    {
      type: 'init',
      canvas: offscreen,
      width: rect.width,
      height: rect.height,
      dpr: globalThis.devicePixelRatio || 1
    },
    [offscreen]
  )

  return {
    ready: () => readyPromise,

    addImages(images) {
      worker.postMessage(
        { type: 'addImages', images },
        images.map((image) => image.bitmap)
      )
    },

    removeImages(ids) {
      if (ids.length > 0) worker.postMessage({ type: 'removeImages', ids })
    },

    setNodes(nodes) {
      worker.postMessage({ type: 'setNodes', nodes })
    },

    setView(view) {
      worker.postMessage({ type: 'setView', ...view })
    },

    resize(width, height) {
      worker.postMessage({ type: 'resize', width, height, dpr: globalThis.devicePixelRatio || 1 })
    },

    start: () => worker.postMessage({ type: 'start' }),
    stop: () => worker.postMessage({ type: 'stop' }),
    clear: () => worker.postMessage({ type: 'clear' }),

    destroy() {
      worker.postMessage({ type: 'stop' })
      worker.terminate()
    }
  }
}
