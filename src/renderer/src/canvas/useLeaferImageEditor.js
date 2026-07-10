/**
 * [INPUT]: 依赖 leafer-editor 的 App/Image、canvasBatching、leaferTreeLifecycle、浏览器 FileReader/URL 对象资源能力与 .mabel 包项目结构
 * [OUTPUT]: 对外提供 Leafer 图片编辑器初始化、按自然尺寸批量图片添加、分批项目加载、选中图片快速排版、指定位置粘贴、自动适配居中、项目导入导出、缩放和资源释放能力
 * [POS]: renderer/canvas 的画布领域逻辑，隔离 Leafer 状态与 Vue 组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { App, Image, PointerEvent } from 'leafer-editor'
import { computed, ref } from 'vue'
import { chunkItems, getLoadBatchSize } from './canvasBatching.mjs'
import { createCanvasHistory } from './canvasHistory.mjs'
import { createTransformHistoryRecorder } from './canvasTransformHistory.mjs'
import { packImages } from './imagePacking.mjs'
import { syncEditorSelectionOverlay } from './leaferEditorSelection.mjs'
import { destroyTreeChildren } from './leaferTreeLifecycle.mjs'
import { getSelectedImageLayout } from './selectedImageLayout.mjs'
import { getContentBounds, getFitView } from './viewportFit.mjs'
import {
  getAnchoredZoomView,
  getManualWheelZoomInteractionConfig,
  getPannedView
} from './viewportZoom.mjs'
import { MABEL_PROJECT_FORMAT_VERSION } from '../../../shared/mabelProject.mjs'

const GAP = 10
const ORIGIN = 10
const MIN_ZOOM = 0.001
const MAX_ZOOM = 1000
const ZOOM_FACTOR = 1.12
const FIT_PADDING = 48
const TRANSFORM_HISTORY_EVENTS = [
  'editor.before_scale',
  'editor.before_rotate',
  'editor.before_skew'
]
const TRANSFORM_HISTORY_RESET_EVENTS = [
  'drag.end',
  'move.end',
  'zoom.end',
  'rotate.end',
  'pointer.up',
  'pointer.cancel'
]

const getId = (prefix) => `${prefix}-${crypto.randomUUID()}`

const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const readFileAsBytes = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      resolve(new Uint8Array(reader.result))
    })
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsArrayBuffer(file)
  })

const base64ToBytes = (base64) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

const bytesToObjectUrl = (bytes, mime) => {
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

const getImageSizeFromUrl = (url) =>
  new Promise((resolve, reject) => {
    const image = new window.Image()

    image.addEventListener('load', () => {
      resolve({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1
      })
    })
    image.addEventListener('error', () => reject(new Error('Cannot load generated image')))
    image.src = url
  })

const getImageSize = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new window.Image()

    image.addEventListener('load', () => {
      resolve({
        url,
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1
      })
    })
    image.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Cannot load image: ${file.name}`))
    })
    image.src = url
  })

const getOriginalPath = (file) => {
  if (file.mabelOriginalPath) return file.mabelOriginalPath

  try {
    return window.api.files.getPath(file)
  } catch {
    return ''
  }
}

export function useLeaferImageEditor() {
  const app = ref(null)
  const files = ref([])
  const zoom = ref(1)
  const selectedImage = ref(null)
  const selectedImageName = computed(() => selectedImage.value?.name || '')
  const selectedOriginalPath = computed(() => selectedImage.value?.originalPath || '')
  const imageContextMenuRequest = ref(null)
  const imageCount = computed(() => files.value.length)
  const isGrayscaleEnabled = ref(false)
  const objectUrls = []
  const history = createCanvasHistory()
  const transformHistory = createTransformHistoryRecorder(() => rememberCanvasState())
  let loadToken = 0
  let restoringHistory = false

  const releaseObjectUrls = () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.length = 0
  }

  const clearCanvas = () => {
    loadToken += 1

    if (app.value?.tree) {
      destroyTreeChildren(app.value.tree)
    }

    files.value = []
    selectedImage.value = null
    isGrayscaleEnabled.value = false
    releaseObjectUrls()
  }

  const applyView = ({ nextZoom, position }) => {
    if (typeof nextZoom === 'number') {
      zoom.value = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)
    }

    if (app.value?.tree) {
      app.value.tree.scale = zoom.value
      app.value.tree.x = position.x
      app.value.tree.y = position.y
      syncEditorSelectionOverlay(app.value.editor)
    }
  }

  const fitToContent = () => {
    if (!app.value || files.value.length === 0) return

    const rect = app.value.view.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const bounds = getContentBounds(
      files.value.map((file) => ({
        x: file.node.x || 0,
        y: file.node.y || 0,
        width: file.node.width || 1,
        height: file.node.height || 1
      }))
    )
    const view = getFitView({
      bounds,
      viewport: { width: rect.width, height: rect.height },
      padding: FIT_PADDING
    })

    applyView({ nextZoom: view.zoom, position: view.position })
  }

  const exportProject = () => ({
    version: MABEL_PROJECT_FORMAT_VERSION,
    canvas: {
      zoom: zoom.value,
      background: 'dot-grid'
    },
    assets: files.value.map((file) => ({
      id: file.assetId,
      name: file.name,
      mime: file.mime,
      bytes: file.bytes,
      originalPath: file.originalPath
    })),
    nodes: files.value.map((file) => ({
      id: file.nodeId,
      type: 'image',
      assetId: file.assetId,
      name: file.name,
      x: file.node.x || 0,
      y: file.node.y || 0,
      width: file.node.width || 1,
      height: file.node.height || 1,
      scaleX: file.node.scaleX ?? 1,
      scaleY: file.node.scaleY ?? 1,
      rotation: file.node.rotation || 0,
      skewX: file.node.skewX || 0,
      skewY: file.node.skewY || 0,
      grayscale: file.node.grayscale || 0,
      opacity: file.node.opacity ?? 1,
      visible: file.node.visible ?? true,
      locked: file.node.locked ?? false
    }))
  })

  const rememberCanvasState = () => {
    if (!restoringHistory) history.push(exportProject())
  }

  const selectImageRecord = (imageRecord) => {
    selectedImage.value = imageRecord
    app.value.editor.select(imageRecord.node)
    syncEditorSelectionOverlay(app.value.editor)
  }

  const requestImageContextMenu = (imageRecord, event) => {
    event?.origin?.preventDefault?.()
    event?.stop?.()

    selectImageRecord(imageRecord)
    imageContextMenuRequest.value = {
      x: event?.origin?.clientX ?? event?.x ?? 0,
      y: event?.origin?.clientY ?? event?.y ?? 0,
      imageName: imageRecord.name,
      nodeId: imageRecord.nodeId,
      token: Date.now()
    }
  }

  const createImageRecord = ({ assetId, bytes, file, node, nodeId, originalPath }) => {
    const imageRecord = {
      assetId,
      bytes,
      mime: file.type || 'application/octet-stream',
      name: file.name,
      node,
      nodeId,
      originalPath
    }

    node.on(PointerEvent.TAP, () => {
      selectedImage.value = imageRecord
    })
    node.on([PointerEvent.MENU, PointerEvent.MENU_TAP], (event) => {
      requestImageContextMenu(imageRecord, event)
    })

    return imageRecord
  }

  const createImageNode = ({ nodeId, source, projectNode }) =>
    new Image({
      id: nodeId,
      url: source.url,
      x: projectNode.x,
      y: projectNode.y,
      width: projectNode.width,
      height: projectNode.height,
      scaleX: projectNode.scaleX ?? 1,
      scaleY: projectNode.scaleY ?? 1,
      rotation: projectNode.rotation,
      skewX: projectNode.skewX || 0,
      skewY: projectNode.skewY || 0,
      grayscale: projectNode.grayscale || 0,
      opacity: projectNode.opacity,
      visible: projectNode.visible,
      locked: projectNode.locked,
      draggable: !projectNode.locked,
      editable: !projectNode.locked
    })

  const applyImageNodeSnapshot = (node, projectNode) => {
    node.x = projectNode.x
    node.y = projectNode.y
    node.width = projectNode.width
    node.height = projectNode.height
    node.scaleX = projectNode.scaleX ?? 1
    node.scaleY = projectNode.scaleY ?? 1
    node.rotation = projectNode.rotation
    node.skewX = projectNode.skewX || 0
    node.skewY = projectNode.skewY || 0
    node.grayscale = projectNode.grayscale || 0
    node.opacity = projectNode.opacity
    node.visible = projectNode.visible
    node.locked = projectNode.locked
    node.draggable = !projectNode.locked
    node.editable = !projectNode.locked
  }

  const mount = (view) => {
    app.value = new App({
      view,
      ...getManualWheelZoomInteractionConfig(),
      editor: {
        boxSelect: true,
        hover: false,
        multipleSelect: true
      }
    })
    app.value.editor.on(TRANSFORM_HISTORY_EVENTS, (event) => {
      transformHistory.remember(event)
    })
    app.value.editor.editBox.on(TRANSFORM_HISTORY_RESET_EVENTS, () => {
      transformHistory.reset()
    })
  }

  const toCanvasPoint = (clientPoint) => {
    const rect = app.value.view.getBoundingClientRect()
    const tree = app.value.tree

    return {
      x: (clientPoint.x - rect.left - (tree.x || 0)) / zoom.value,
      y: (clientPoint.y - rect.top - (tree.y || 0)) / zoom.value
    }
  }

  const getSelectedRecords = () => {
    const selectedNodes = new Set(app.value?.editor?.list || [])
    return files.value.filter((file) => selectedNodes.has(file.node))
  }

  const getImageRecordAtClientPoint = (clientPoint) => {
    if (!app.value) return null

    const point = toCanvasPoint(clientPoint)
    const rect = app.value.view.getBoundingClientRect()
    const worldPoint = {
      x: clientPoint.x - rect.left,
      y: clientPoint.y - rect.top
    }

    for (let index = files.value.length - 1; index >= 0; index -= 1) {
      const file = files.value[index]
      const left = file.node.x || 0
      const top = file.node.y || 0
      const width = Math.abs((file.node.width || 1) * (file.node.scaleX ?? 1))
      const height = Math.abs((file.node.height || 1) * (file.node.scaleY ?? 1))
      const hitNode = typeof file.node.hit === 'function' && file.node.hit(worldPoint)

      if (
        hitNode ||
        (point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height)
      ) {
        return file
      }
    }

    return null
  }

  const selectImageAtClientPoint = (clientPoint) => {
    const imageRecord = getImageRecordAtClientPoint(clientPoint)
    if (!imageRecord) return null

    selectImageRecord(imageRecord)
    return {
      name: imageRecord.name,
      nodeId: imageRecord.nodeId
    }
  }

  const getImageEditSource = (nodeId) => {
    const imageRecord = files.value.find((file) => file.nodeId === nodeId)
    if (!imageRecord) return null

    return {
      bytes: [...imageRecord.bytes],
      mime: imageRecord.mime,
      name: imageRecord.name,
      nodeId: imageRecord.nodeId
    }
  }

  const replaceImageWithBytes = async ({ nodeId, bytes, mime }) => {
    const imageRecord = files.value.find((file) => file.nodeId === nodeId)
    if (!imageRecord || !bytes?.length) return false

    rememberCanvasState()
    const nextBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    const url = bytesToObjectUrl(nextBytes, mime || imageRecord.mime)
    const size = await getImageSizeFromUrl(url)
    const previousArea = Math.max(1, (imageRecord.node.width || 1) * (imageRecord.node.height || 1))
    const nextArea = Math.max(1, size.width * size.height)
    const fitScale = Math.sqrt(previousArea / nextArea)

    imageRecord.bytes = nextBytes
    imageRecord.mime = mime || imageRecord.mime
    imageRecord.node.url = url
    imageRecord.node.width = size.width
    imageRecord.node.height = size.height
    imageRecord.node.scaleX = fitScale
    imageRecord.node.scaleY = fitScale
    objectUrls.push(url)
    syncEditorSelectionOverlay(app.value.editor)
    return true
  }

  const layoutSelectedImages = () => {
    const selectedRecords = getSelectedRecords()
    if (selectedRecords.length < 2) return 0

    rememberCanvasState()
    const viewportWidth = app.value.view.getBoundingClientRect().width
    const layout = getSelectedImageLayout({
      records: selectedRecords,
      viewportWidth,
      gap: GAP
    })

    selectedRecords.forEach((file, index) => {
      file.node.x = layout[index].x
      file.node.y = layout[index].y
    })

    return selectedRecords.length
  }

  const deleteSelectedImages = () => {
    const selectedRecords = getSelectedRecords()
    if (selectedRecords.length === 0) return 0

    rememberCanvasState()
    const selectedNodes = new Set(selectedRecords.map((file) => file.node))

    selectedRecords.forEach((file) => {
      app.value.tree.remove(file.node, true)
    })
    files.value = files.value.filter((file) => !selectedNodes.has(file.node))
    selectedImage.value = null
    syncEditorSelectionOverlay(app.value.editor)

    return selectedRecords.length
  }

  const moveSelectedImagesLayer = (direction) => {
    const selectedNodes = new Set(app.value?.editor?.list || [])
    if (selectedNodes.size === 0) return 0

    const currentFiles = [...files.value]
    let movedCount = 0

    if (direction > 0) {
      for (let index = currentFiles.length - 2; index >= 0; index -= 1) {
        const currentIsSelected = selectedNodes.has(currentFiles[index].node)
        const nextIsSelected = selectedNodes.has(currentFiles[index + 1].node)

        if (currentIsSelected && !nextIsSelected) {
          ;[currentFiles[index], currentFiles[index + 1]] = [currentFiles[index + 1], currentFiles[index]]
          movedCount += 1
        }
      }
    } else {
      for (let index = 1; index < currentFiles.length; index += 1) {
        const currentIsSelected = selectedNodes.has(currentFiles[index].node)
        const previousIsSelected = selectedNodes.has(currentFiles[index - 1].node)

        if (currentIsSelected && !previousIsSelected) {
          ;[currentFiles[index], currentFiles[index - 1]] = [currentFiles[index - 1], currentFiles[index]]
          movedCount += 1
        }
      }
    }

    if (movedCount === 0) return 0

    rememberCanvasState()
    files.value = currentFiles
    currentFiles.forEach((file) => {
      app.value.tree.add(file.node)
    })
    syncEditorSelectionOverlay(app.value.editor)
    return movedCount
  }

  const addFiles = async (imageFiles) => {
    if (!app.value || imageFiles.length === 0) return 0

    const rect = app.value.view.getBoundingClientRect()
    const startY =
      files.value.reduce(
        (bottom, file) => Math.max(bottom, (file.node.y || 0) + (file.node.height || 0)),
        0
      ) + (files.value.length > 0 ? GAP : 0)
    const importedFiles = []
    const sources = []

    for (const file of imageFiles) {
      try {
        const source = await getImageSize(file)
        const assetId = getId('asset')
        const nodeId = getId('node')
        const bytes = await readFileAsBytes(file)
        const originalPath = getOriginalPath(file)

        sources.push({ assetId, bytes, file, nodeId, originalPath, source })
      } catch {
        // Keep importing the rest of the dropped files if one image cannot be decoded.
      }
    }

    if (sources.length === 0) return 0

    const layout = packImages({
      items: sources.map(({ source }) => ({ width: source.width, height: source.height })),
      viewportWidth: rect.width,
      gap: GAP,
      origin: ORIGIN
    })

    for (const [index, item] of sources.entries()) {
      const position = layout[index]
      const node = new Image({
        id: item.nodeId,
        url: item.source.url,
        x: position.x,
        y: position.y + startY,
        width: position.width,
        height: position.height,
        grayscale: isGrayscaleEnabled.value ? 1 : 0,
        draggable: true,
        editable: true
      })
      const imageRecord = createImageRecord({
        assetId: item.assetId,
        bytes: item.bytes,
        file: item.file,
        node,
        nodeId: item.nodeId,
        originalPath: item.originalPath
      })

      app.value.tree.add(node)
      objectUrls.push(item.source.url)
      importedFiles.push(imageRecord)
    }

    files.value = [...files.value, ...importedFiles]
    fitToContent()
    return importedFiles.length
  }

  const pasteFilesAt = async (imageFiles, clientPoint) => {
    if (!app.value || imageFiles.length === 0) return 0

    const point = toCanvasPoint(clientPoint)
    const importedFiles = []
    let nextY = point.y

    for (const file of imageFiles) {
      try {
        const source = await getImageSize(file)
        const assetId = getId('asset')
        const nodeId = getId('node')
        const bytes = await readFileAsBytes(file)
        const originalPath = getOriginalPath(file)
        const node = new Image({
          id: nodeId,
          url: source.url,
          x: point.x,
          y: nextY,
          width: source.width,
          height: source.height,
          grayscale: isGrayscaleEnabled.value ? 1 : 0,
          draggable: true,
          editable: true
        })
        const imageRecord = createImageRecord({
          assetId,
          bytes,
          file,
          node,
          nodeId,
          originalPath
        })

        app.value.tree.add(node)
        objectUrls.push(source.url)
        importedFiles.push(imageRecord)
        nextY += source.height + GAP
      } catch {
        // Keep importing the rest of the pasted files if one image cannot be decoded.
      }
    }

    files.value = [...files.value, ...importedFiles]
    return importedFiles.length
  }

  const setZoom = (nextZoom) => {
    zoom.value = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)

    if (app.value?.tree) {
      app.value.tree.scale = zoom.value
      syncEditorSelectionOverlay(app.value.editor)
    }
  }

  const setZoomAt = (nextZoom, clientPoint) => {
    if (!app.value?.tree) {
      setZoom(nextZoom)
      return
    }

    const rect = app.value.view.getBoundingClientRect()
    const clampedZoom = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)
    const view = getAnchoredZoomView({
      anchor: {
        x: clientPoint.x - rect.left,
        y: clientPoint.y - rect.top
      },
      currentPosition: {
        x: app.value.tree.x || 0,
        y: app.value.tree.y || 0
      },
      currentZoom: zoom.value,
      nextZoom: clampedZoom
    })

    applyView(view)
  }

  const panByWheelDelta = (delta) => {
    if (!app.value?.tree) return

    const view = getPannedView({
      currentPosition: {
        x: app.value.tree.x || 0,
        y: app.value.tree.y || 0
      },
      delta
    })

    applyView({ nextZoom: zoom.value, position: view.position })
  }

  const zoomIn = () => setZoom(zoom.value * ZOOM_FACTOR)
  const zoomOut = () => setZoom(zoom.value / ZOOM_FACTOR)
  const zoomAtFactor = (factor, clientPoint) => setZoomAt(zoom.value * factor, clientPoint)
  const zoomInAt = (clientPoint) => setZoomAt(zoom.value * ZOOM_FACTOR, clientPoint)
  const zoomOutAt = (clientPoint) => setZoomAt(zoom.value / ZOOM_FACTOR, clientPoint)

  const loadProject = async (
    project,
    onProgress = () => {},
    { resetHistory = true, fitView = true } = {}
  ) => {
    if (!app.value) return

    const previousView = {
      zoom: zoom.value,
      position: {
        x: app.value.tree?.x || 0,
        y: app.value.tree?.y || 0
      }
    }
    clearCanvas()
    if (resetHistory) history.clear()
    const currentLoadToken = loadToken
    setZoom(project.canvas?.zoom || 1)

    const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
    const importedFiles = []
    const imageNodes = project.nodes.filter((projectNode) => projectNode.type === 'image')
    let loadedCount = 0

    onProgress({ loaded: 0, total: imageNodes.length })
    await nextFrame()

    for (const batch of chunkItems(imageNodes, getLoadBatchSize(imageNodes.length))) {
      if (currentLoadToken !== loadToken) return

      for (const projectNode of batch) {
        const asset = assetMap.get(projectNode.assetId)
        if (!asset) continue

        const bytes = asset.bytes || base64ToBytes(asset.data)
        const url = bytesToObjectUrl(bytes, asset.mime)
        const node = createImageNode({
          nodeId: projectNode.id,
          source: { url },
          projectNode
        })
        const imageRecord = createImageRecord({
          assetId: asset.id,
          bytes,
          file: { name: asset.name, type: asset.mime },
          node,
          nodeId: projectNode.id,
          originalPath: asset.originalPath || ''
        })

        app.value.tree.add(node)
        objectUrls.push(url)
        importedFiles.push(imageRecord)
      }

      loadedCount += batch.length
      onProgress({ loaded: loadedCount, total: imageNodes.length })
      await nextFrame()
    }

    if (currentLoadToken !== loadToken) return
    files.value = importedFiles
    isGrayscaleEnabled.value =
      importedFiles.length > 0 && importedFiles.every((file) => Boolean(file.node.grayscale))
    if (fitView) {
      fitToContent()
    } else {
      applyView({ nextZoom: previousView.zoom, position: previousView.position })
    }
  }

  const restoreProjectSnapshot = (project) => {
    const previousView = {
      zoom: zoom.value,
      position: {
        x: app.value.tree?.x || 0,
        y: app.value.tree?.y || 0
      }
    }
    const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
    const recordMap = new Map(files.value.map((file) => [file.nodeId, file]))
    const nextNodeIds = new Set(project.nodes.map((projectNode) => projectNode.id))
    const nextFiles = []

    files.value.forEach((file) => {
      if (!nextNodeIds.has(file.nodeId)) {
        app.value.tree.remove(file.node, true)
      }
    })

    project.nodes
      .filter((projectNode) => projectNode.type === 'image')
      .forEach((projectNode) => {
        const asset = assetMap.get(projectNode.assetId)
        if (!asset) return

        const existingRecord = recordMap.get(projectNode.id)
        if (existingRecord) {
          applyImageNodeSnapshot(existingRecord.node, projectNode)
          nextFiles.push({
            ...existingRecord,
            assetId: asset.id,
            bytes: asset.bytes || base64ToBytes(asset.data),
            mime: asset.mime,
            name: asset.name,
            originalPath: asset.originalPath || ''
          })
          return
        }

        const bytes = asset.bytes || base64ToBytes(asset.data)
        const url = bytesToObjectUrl(bytes, asset.mime)
        const node = createImageNode({
          nodeId: projectNode.id,
          source: { url },
          projectNode
        })
        const imageRecord = createImageRecord({
          assetId: asset.id,
          bytes,
          file: { name: asset.name, type: asset.mime },
          node,
          nodeId: projectNode.id,
          originalPath: asset.originalPath || ''
        })

        app.value.tree.add(node)
        objectUrls.push(url)
        nextFiles.push(imageRecord)
      })

    files.value = nextFiles
    nextFiles.forEach((file) => {
      app.value.tree.add(file.node)
    })
    selectedImage.value = null
    isGrayscaleEnabled.value =
      nextFiles.length > 0 && nextFiles.every((file) => Boolean(file.node.grayscale))
    applyView({ nextZoom: previousView.zoom, position: previousView.position })
  }

  const undo = async () => {
    const snapshot = history.undo(exportProject())
    if (!snapshot) return false

    restoringHistory = true
    try {
      restoreProjectSnapshot(snapshot)
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
      restoreProjectSnapshot(snapshot)
    } finally {
      restoringHistory = false
    }
    return true
  }

  const toggleAllImagesGrayscale = () => {
    if (files.value.length === 0) return false

    isGrayscaleEnabled.value = !isGrayscaleEnabled.value
    files.value.forEach((file) => {
      file.node.grayscale = isGrayscaleEnabled.value ? 1 : 0
    })
    return isGrayscaleEnabled.value
  }

  const destroy = () => {
    clearCanvas()
    app.value?.destroy()
    app.value = null
  }

  return {
    addFiles,
    deleteSelectedImages,
    destroy,
    exportProject,
    imageCount,
    imageContextMenuRequest,
    isGrayscaleEnabled,
    layoutSelectedImages,
    loadProject,
    mount,
    moveSelectedImagesLayer,
    panByWheelDelta,
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
