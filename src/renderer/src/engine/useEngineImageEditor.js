/**
 * [INPUT]: 依赖 engineClient/assetPipeline/editor 全家桶、canvas 纯函数（batching/history/packing/layout/viewportFit/viewportZoom）、mabelProject 格式与浏览器 File/Blob
 * [OUTPUT]: 对外提供 useEngineImageEditor——与旧 Leafer composable 同构的画布 API（导入/粘贴/复制/删除/排版/层级/缩放/灰度/撤销重做/项目快照/AI 换图），addFiles/pasteFilesAt/loadProject 均带逐图进度回调，渲染走 WebGPU 引擎
 * [POS]: engine 的 Vue 接入层，主应用画布的唯一 composable；资产表持原始 bytes 供导出，GPU 只持显示位图纹理
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ref } from 'vue'
import { createCanvasHistory } from '../canvas/canvasHistory.mjs'
import { packImages } from '../canvas/imagePacking.mjs'
import { getSelectedImageLayout } from '../canvas/selectedImageLayout.mjs'
import { getFitView } from '../canvas/viewportFit.mjs'
import { getAnchoredZoomView, getPannedView } from '../canvas/viewportZoom.mjs'
import { MABEL_PROJECT_FORMAT_VERSION } from '../../../shared/mabelProject.mjs'
import { decodeDisplayBitmap } from './assetPipeline.mjs'
import { createEngineClient } from './engineClient.mjs'
import { createEditorController } from './editor/editorController.mjs'
import { getNodeAabb, getTopmostHit } from './editor/hitTesting.mjs'
import { getSelectionBounds } from './editor/editorTransforms.mjs'
import { createSceneStore } from './editor/sceneStore.mjs'
import { createSelectionOverlay } from './editor/selectionOverlay.mjs'

const GAP = 10
const ORIGIN = 10
const MIN_ZOOM = 0.001
const MAX_ZOOM = 1000
const ZOOM_FACTOR = 1.12
const FIT_PADDING = 48

const getId = (prefix) => `${prefix}-${crypto.randomUUID()}`

const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const base64ToBytes = (base64) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

const toBytes = (value) => (value instanceof Uint8Array ? value : new Uint8Array(value))

const bytesToBlob = (bytes, mime) => new Blob([bytes], { type: mime || 'application/octet-stream' })

const getOriginalPath = (file) => {
  if (file.mabelOriginalPath) return file.mabelOriginalPath

  try {
    return window.api.files.getPath(file)
  } catch {
    return ''
  }
}

export function useEngineImageEditor() {
  const zoom = ref(1)
  const imageCount = ref(0)
  const selectedImageName = ref('')
  const selectedOriginalPath = ref('')
  const imageContextMenuRequest = ref(null)
  const isGrayscaleEnabled = ref(false)

  const store = createSceneStore()
  const assets = new Map()
  const history = createCanvasHistory()

  let engine = null
  let controller = null
  let overlay = null
  let host = null
  let canvasElement = null
  let overlayElement = null
  let resizeObserver = null
  let view = { x: 0, y: 0 }
  let restoringHistory = false
  let loadToken = 0

  // ---- 视口 ----

  const getViewState = () => ({ zoom: zoom.value, x: view.x, y: view.y })

  const drawOverlay = () => {
    overlay?.draw({
      view: getViewState(),
      selectedNodes: store.getSelectedNodes(),
      marquee: controller?.getMarquee() || null
    })
  }

  const applyView = ({ nextZoom, position }) => {
    if (typeof nextZoom === 'number') {
      zoom.value = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)
    }

    view = { x: position.x, y: position.y }
    engine?.setView(getViewState())
    drawOverlay()
  }

  const fitToContent = () => {
    const nodes = store.getNodes()
    if (!host || nodes.length === 0) return

    const rect = host.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const fitted = getFitView({
      bounds: getSelectionBounds(nodes),
      viewport: { width: rect.width, height: rect.height },
      padding: FIT_PADDING
    })

    applyView({ nextZoom: fitted.zoom, position: fitted.position })
  }

  const toCanvasPoint = (clientPoint) => {
    const rect = host.getBoundingClientRect()

    return {
      x: (clientPoint.x - rect.left - view.x) / zoom.value,
      y: (clientPoint.y - rect.top - view.y) / zoom.value
    }
  }

  // ---- 项目快照与历史 ----

  const exportProject = () => {
    const nodes = store.getNodes()

    return {
      version: MABEL_PROJECT_FORMAT_VERSION,
      canvas: {
        zoom: zoom.value,
        background: 'dot-grid'
      },
      assets: nodes.map((node) => {
        const asset = assets.get(node.assetId)

        return {
          id: node.assetId,
          name: asset?.name || '',
          mime: asset?.mime || 'application/octet-stream',
          bytes: asset?.bytes || new Uint8Array(),
          originalPath: asset?.originalPath || ''
        }
      }),
      nodes: nodes.map((node) => ({
        id: node.id,
        type: 'image',
        assetId: node.assetId,
        name: assets.get(node.assetId)?.name || '',
        x: node.x || 0,
        y: node.y || 0,
        width: node.width || 1,
        height: node.height || 1,
        scaleX: node.scaleX ?? 1,
        scaleY: node.scaleY ?? 1,
        rotation: node.rotation || 0,
        skewX: 0,
        skewY: 0,
        grayscale: node.grayscale || 0,
        opacity: node.opacity ?? 1,
        visible: node.visible ?? true,
        locked: node.locked ?? false
      }))
    }
  }

  const rememberCanvasState = () => {
    if (!restoringHistory) history.push(exportProject())
  }

  // ---- 资产与纹理 ----

  const uploadAsset = async ({ assetId, bytes, mime, name, originalPath }) => {
    const decoded = await decodeDisplayBitmap(bytesToBlob(bytes, mime))

    engine.addImages([{ id: assetId, bitmap: decoded.bitmap }])
    assets.set(assetId, { bytes, mime, name, originalPath })
    return decoded
  }

  const removeOrphanAssets = () => {
    const referenced = new Set(store.getNodes().map((node) => node.assetId))
    const orphanIds = [...assets.keys()].filter((assetId) => !referenced.has(assetId))

    orphanIds.forEach((assetId) => assets.delete(assetId))
    engine.removeImages(orphanIds)
  }

  const createNodeRecord = (projectNode) => ({
    id: projectNode.id,
    assetId: projectNode.assetId,
    textureId: projectNode.assetId,
    x: projectNode.x || 0,
    y: projectNode.y || 0,
    width: projectNode.width || 1,
    height: projectNode.height || 1,
    scaleX: projectNode.scaleX ?? 1,
    scaleY: projectNode.scaleY ?? 1,
    rotation: projectNode.rotation || 0,
    opacity: projectNode.opacity ?? 1,
    grayscale: projectNode.grayscale || 0,
    visible: projectNode.visible ?? true,
    locked: projectNode.locked ?? false
  })

  // ---- 挂载 ----

  const mount = (hostElement) => {
    host = hostElement
    host.style.position = 'relative'
    canvasElement = document.createElement('canvas')
    overlayElement = document.createElement('canvas')

    for (const element of [canvasElement, overlayElement]) {
      element.style.position = 'absolute'
      element.style.inset = '0'
      element.style.width = '100%'
      element.style.height = '100%'
    }
    overlayElement.style.pointerEvents = 'none'
    host.append(canvasElement, overlayElement)

    engine = createEngineClient(canvasElement, {
      onError: (error) => console.error('[engine]', error)
    })
    overlay = createSelectionOverlay(overlayElement)
    controller = createEditorController({
      element: host,
      store,
      getView: getViewState,
      setView: (nextView) =>
        applyView({ nextZoom: nextView.zoom, position: { x: nextView.x, y: nextView.y } }),
      onOverlayChange: drawOverlay,
      onHistoryPoint: rememberCanvasState,
      bindWheel: false,
      bindKeyboard: false
    })

    const handleResize = () => {
      const rect = host.getBoundingClientRect()

      engine.resize(rect.width, rect.height)
      overlay.resize(rect.width, rect.height, devicePixelRatio)
      drawOverlay()
    }

    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(host)
    engine.ready().then(() => {
      engine.start()
      handleResize()
    })
  }

  store.subscribe(() => {
    const nodes = store.getNodes()

    imageCount.value = nodes.length
    engine?.setNodes(nodes.filter((node) => node.visible !== false))
    drawOverlay()

    const selected = store.getSelectedNodes()
    const asset = selected.length > 0 ? assets.get(selected[selected.length - 1].assetId) : null

    selectedImageName.value = asset?.name || ''
    selectedOriginalPath.value = asset?.originalPath || ''
  })

  // ---- 导入与粘贴 ----

  const prepareFile = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const decoded = await decodeDisplayBitmap(file)

    return {
      assetId: getId('asset'),
      nodeId: getId('node'),
      bytes,
      mime: file.type || 'application/octet-stream',
      name: file.name,
      originalPath: getOriginalPath(file),
      decoded
    }
  }

  const registerPrepared = (item, position) => {
    engine.addImages([{ id: item.assetId, bitmap: item.decoded.bitmap }])
    assets.set(item.assetId, {
      bytes: item.bytes,
      mime: item.mime,
      name: item.name,
      originalPath: item.originalPath
    })

    return createNodeRecord({
      id: item.nodeId,
      assetId: item.assetId,
      x: position.x,
      y: position.y,
      width: item.decoded.width,
      height: item.decoded.height,
      grayscale: isGrayscaleEnabled.value ? 1 : 0
    })
  }

  const addFiles = async (imageFiles, onProgress = () => {}) => {
    if (!engine || imageFiles.length === 0) return 0

    const rect = host.getBoundingClientRect()
    const startY =
      store.getNodes().reduce((bottom, node) => {
        const aabb = getNodeAabb(node)
        return Math.max(bottom, aabb.y + aabb.height)
      }, 0) + (store.getNodes().length > 0 ? GAP : 0)
    const prepared = []
    let processedCount = 0

    onProgress({ loaded: 0, total: imageFiles.length })
    for (const file of imageFiles) {
      try {
        prepared.push(await prepareFile(file))
      } catch {
        // Keep importing the rest of the dropped files if one image cannot be decoded.
      }
      processedCount += 1
      onProgress({ loaded: processedCount, total: imageFiles.length })
    }

    if (prepared.length === 0) return 0

    const layout = packImages({
      items: prepared.map((item) => ({ width: item.decoded.width, height: item.decoded.height })),
      viewportWidth: rect.width,
      gap: GAP,
      origin: ORIGIN
    })
    const newNodes = prepared.map((item, index) =>
      registerPrepared(item, { x: layout[index].x, y: layout[index].y + startY })
    )

    store.addNodes(newNodes)
    fitToContent()
    return newNodes.length
  }

  const pasteFilesAt = async (imageFiles, clientPoint, onProgress = () => {}) => {
    if (!engine || imageFiles.length === 0) return 0

    const point = toCanvasPoint(clientPoint)
    const newNodes = []
    let nextY = point.y
    let processedCount = 0

    onProgress({ loaded: 0, total: imageFiles.length })
    for (const file of imageFiles) {
      try {
        const item = await prepareFile(file)

        newNodes.push(registerPrepared(item, { x: point.x, y: nextY }))
        nextY += item.decoded.height + GAP
      } catch {
        // Keep importing the rest of the pasted files if one image cannot be decoded.
      }
      processedCount += 1
      onProgress({ loaded: processedCount, total: imageFiles.length })
    }

    store.addNodes(newNodes)
    return newNodes.length
  }

  const pasteCopiedImagesAt = async (copiedImages, clientPoint) => {
    if (!engine || copiedImages.length === 0) return 0

    rememberCanvasState()
    const point = toCanvasPoint(clientPoint)
    const minX = Math.min(...copiedImages.map((image) => image.x || 0))
    const minY = Math.min(...copiedImages.map((image) => image.y || 0))
    const newNodes = []

    for (const image of copiedImages) {
      try {
        const bytes = toBytes(image.bytes)
        const assetId = getId('asset')
        const decoded = await uploadAsset({
          assetId,
          bytes,
          mime: image.mime || 'image/png',
          name: image.name || 'copied-image.png',
          originalPath: image.originalPath || ''
        })

        newNodes.push(
          createNodeRecord({
            id: getId('node'),
            assetId,
            x: point.x + (image.x || 0) - minX,
            y: point.y + (image.y || 0) - minY,
            width: image.width || decoded.width,
            height: image.height || decoded.height,
            scaleX: image.scaleX ?? 1,
            scaleY: image.scaleY ?? 1,
            rotation: image.rotation || 0,
            grayscale: isGrayscaleEnabled.value ? 1 : 0
          })
        )
      } catch {
        // Keep pasting the rest if one copied image cannot be restored.
      }
    }

    store.addNodes(newNodes)
    return newNodes.length
  }

  const copySelectedImages = () =>
    store.getSelectedNodes().map((node) => {
      const asset = assets.get(node.assetId)

      return {
        bytes: new Uint8Array(asset?.bytes || []),
        height: node.height || 1,
        mime: asset?.mime || 'image/png',
        name: asset?.name || '',
        originalPath: asset?.originalPath || '',
        rotation: node.rotation || 0,
        scaleX: node.scaleX ?? 1,
        scaleY: node.scaleY ?? 1,
        width: node.width || 1,
        x: node.x || 0,
        y: node.y || 0
      }
    })

  // ---- 编辑操作 ----

  const deleteSelectedImages = () => {
    if (store.getSelectedIds().length === 0) return 0

    rememberCanvasState()
    const removedCount = store.removeSelected()

    removeOrphanAssets()
    return removedCount
  }

  const layoutSelectedImages = () => {
    const selected = store.getSelectedNodes()
    if (selected.length < 2) return 0

    rememberCanvasState()
    const layout = getSelectedImageLayout({
      records: selected.map((node) => ({ node })),
      viewportWidth: host.getBoundingClientRect().width,
      gap: GAP
    })
    const patches = new Map(
      selected.map((node, index) => [node.id, { x: layout[index].x, y: layout[index].y }])
    )

    store.applyPatches(patches)
    return selected.length
  }

  const moveSelectedImagesLayer = (direction) => {
    const selectedIds = new Set(store.getSelectedIds())
    if (selectedIds.size === 0) return 0

    const currentNodes = [...store.getNodes()]
    let movedCount = 0

    if (direction > 0) {
      for (let index = currentNodes.length - 2; index >= 0; index -= 1) {
        if (
          selectedIds.has(currentNodes[index].id) &&
          !selectedIds.has(currentNodes[index + 1].id)
        ) {
          ;[currentNodes[index], currentNodes[index + 1]] = [
            currentNodes[index + 1],
            currentNodes[index]
          ]
          movedCount += 1
        }
      }
    } else {
      for (let index = 1; index < currentNodes.length; index += 1) {
        if (
          selectedIds.has(currentNodes[index].id) &&
          !selectedIds.has(currentNodes[index - 1].id)
        ) {
          ;[currentNodes[index], currentNodes[index - 1]] = [
            currentNodes[index - 1],
            currentNodes[index]
          ]
          movedCount += 1
        }
      }
    }

    if (movedCount === 0) return 0

    rememberCanvasState()
    const selection = store.getSelectedIds()

    store.setNodes(currentNodes)
    store.setSelection(selection)
    return movedCount
  }

  const toggleAllImagesGrayscale = () => {
    const nodes = store.getNodes()
    if (nodes.length === 0) return false

    isGrayscaleEnabled.value = !isGrayscaleEnabled.value
    store.applyPatches(
      new Map(nodes.map((node) => [node.id, { grayscale: isGrayscaleEnabled.value ? 1 : 0 }]))
    )
    return isGrayscaleEnabled.value
  }

  const selectImageAtClientPoint = (clientPoint) => {
    if (!host) return null

    const hit = getTopmostHit(store.getNodes(), toCanvasPoint(clientPoint))
    if (!hit) return null

    store.setSelection([hit.id])
    return {
      name: assets.get(hit.assetId)?.name || '',
      nodeId: hit.id
    }
  }

  const getImageEditSource = (nodeId) => {
    const node = store.getNode(nodeId)
    const asset = node && assets.get(node.assetId)
    if (!asset) return null

    return {
      bytes: [...asset.bytes],
      mime: asset.mime,
      name: asset.name,
      nodeId
    }
  }

  const replaceImageWithBytes = async ({ nodeId, bytes, mime }) => {
    const node = store.getNode(nodeId)
    if (!node || !bytes?.length) return false

    rememberCanvasState()
    const previousAsset = assets.get(node.assetId)
    const assetId = getId('asset')
    const decoded = await uploadAsset({
      assetId,
      bytes: toBytes(bytes),
      mime: mime || previousAsset?.mime || 'image/png',
      name: previousAsset?.name || 'image.png',
      originalPath: previousAsset?.originalPath || ''
    })
    const previousArea = Math.max(1, (node.width || 1) * (node.height || 1))
    const fitScale = Math.sqrt(previousArea / Math.max(1, decoded.width * decoded.height))

    store.applyPatches(
      new Map([
        [
          nodeId,
          {
            assetId,
            textureId: assetId,
            width: decoded.width,
            height: decoded.height,
            scaleX: fitScale,
            scaleY: fitScale
          }
        ]
      ])
    )
    removeOrphanAssets()
    return true
  }

  // ---- 缩放 ----

  const setZoom = (nextZoom) => applyView({ nextZoom, position: view })

  const setZoomAt = (nextZoom, clientPoint) => {
    const rect = host.getBoundingClientRect()
    const clamped = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)
    const next = getAnchoredZoomView({
      anchor: { x: clientPoint.x - rect.left, y: clientPoint.y - rect.top },
      currentPosition: view,
      currentZoom: zoom.value,
      nextZoom: clamped
    })

    applyView({ nextZoom: next.nextZoom, position: next.position })
  }

  const panByWheelDelta = (delta) => {
    applyView({
      nextZoom: zoom.value,
      position: getPannedView({ currentPosition: view, delta }).position
    })
  }

  const zoomIn = () => setZoom(zoom.value * ZOOM_FACTOR)
  const zoomOut = () => setZoom(zoom.value / ZOOM_FACTOR)
  const zoomAtFactor = (factor, clientPoint) => setZoomAt(zoom.value * factor, clientPoint)
  const zoomInAt = (clientPoint) => setZoomAt(zoom.value * ZOOM_FACTOR, clientPoint)
  const zoomOutAt = (clientPoint) => setZoomAt(zoom.value / ZOOM_FACTOR, clientPoint)

  // ---- 项目加载与历史 ----

  const clearScene = () => {
    loadToken += 1
    store.setSelection([])
    store.setNodes([])
    engine?.clear()
    assets.clear()
    isGrayscaleEnabled.value = false
  }

  // Keep the current canvas visible while a replacement project is being read,
  // but let its CPU decode loop stop as soon as another project is requested.
  const cancelProjectLoad = () => {
    loadToken += 1
  }

  const loadProject = async (
    project,
    onProgress = () => {},
    { resetHistory = true, fitView = true } = {}
  ) => {
    if (!engine) return

    const previousView = { zoom: zoom.value, position: view }

    clearScene()
    if (resetHistory) history.clear()
    const currentLoadToken = loadToken

    setZoom(project.canvas?.zoom || 1)

    const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
    const imageNodes = project.nodes.filter((projectNode) => projectNode.type === 'image')
    let loadedCount = 0

    onProgress({ loaded: 0, total: imageNodes.length })
    await nextFrame()

    // Match direct file imports: finish every CPU decode first, then submit the
    // prepared display bitmaps in the same one-image-per-worker-message sequence.
    // The progress dialog is therefore never coupled to the GPU upload queue.
    const prepared = []
    for (const projectNode of imageNodes) {
      if (currentLoadToken !== loadToken) return

      const asset = assetMap.get(projectNode.assetId)
      if (asset) {
        try {
          const bytes = toBytes(asset.bytes || base64ToBytes(asset.data))
          const decoded = await decodeDisplayBitmap(bytesToBlob(bytes, asset.mime))
          prepared.push({ projectNode, asset, bytes, decoded })
        } catch {
          // Keep loading the rest of the project if one image cannot be decoded.
        }
      }

      loadedCount += 1
      onProgress({ loaded: loadedCount, total: imageNodes.length })
    }

    if (currentLoadToken !== loadToken) return
    const newNodes = prepared.map((item) => {
      engine.addImages([{ id: item.asset.id, bitmap: item.decoded.bitmap }])
      assets.set(item.asset.id, {
        bytes: item.bytes,
        mime: item.asset.mime,
        name: item.asset.name,
        originalPath: item.asset.originalPath || ''
      })
      return createNodeRecord(item.projectNode)
    })
    store.addNodes(newNodes)

    const nodes = store.getNodes()

    isGrayscaleEnabled.value = nodes.length > 0 && nodes.every((node) => Boolean(node.grayscale))
    if (fitView) fitToContent()
    else applyView({ nextZoom: previousView.zoom, position: previousView.position })
  }

  const restoreProjectSnapshot = async (project) => {
    const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
    const nextNodes = []

    for (const projectNode of project.nodes.filter((node) => node.type === 'image')) {
      const asset = assetMap.get(projectNode.assetId)
      if (!asset) continue

      try {
        if (!assets.has(asset.id)) {
          await uploadAsset({
            assetId: asset.id,
            bytes: toBytes(asset.bytes || base64ToBytes(asset.data)),
            mime: asset.mime,
            name: asset.name,
            originalPath: asset.originalPath || ''
          })
        }
        nextNodes.push(createNodeRecord(projectNode))
      } catch {
        // Keep restoring the rest of the snapshot if one image cannot be decoded.
      }
    }

    store.setSelection([])
    store.setNodes(nextNodes)
    removeOrphanAssets()
    isGrayscaleEnabled.value =
      nextNodes.length > 0 && nextNodes.every((node) => Boolean(node.grayscale))
  }

  const undo = async () => {
    const snapshot = history.undo(exportProject())
    if (!snapshot) return false

    restoringHistory = true
    try {
      await restoreProjectSnapshot(snapshot)
    } finally {
      restoringHistory = false
    }
    return true
  }

  const redo = async () => {
    const snapshot = history.redo(exportProject())
    if (!snapshot) return false

    restoringHistory = true
    try {
      await restoreProjectSnapshot(snapshot)
    } finally {
      restoringHistory = false
    }
    return true
  }

  const destroy = () => {
    clearScene()
    controller?.destroy()
    resizeObserver?.disconnect()
    engine?.destroy()
    canvasElement?.remove()
    overlayElement?.remove()
    engine = null
    controller = null
    overlay = null
    host = null
  }

  return {
    addFiles,
    copySelectedImages,
    deleteSelectedImages,
    destroy,
    exportProject,
    imageCount,
    imageContextMenuRequest,
    isGrayscaleEnabled,
    layoutSelectedImages,
    loadProject,
    cancelProjectLoad,
    mount,
    moveSelectedImagesLayer,
    panByWheelDelta,
    pasteCopiedImagesAt,
    pasteFilesAt,
    resetView: fitToContent,
    redo,
    getImageEditSource,
    replaceImageWithBytes,
    selectImageAtClientPoint,
    selectedImageName,
    selectedOriginalPath,
    showSelectedInFolder: () => window.api.files.showInFolder(selectedOriginalPath.value),
    toggleAllImagesGrayscale,
    undo,
    zoomAtFactor,
    zoomIn,
    zoomInAt,
    zoomOut,
    zoomOutAt
  }
}
