/**
 * [INPUT]: 依赖 leafer-editor 的 App/Image、canvasBatching、leaferTreeLifecycle、浏览器 FileReader/URL 对象资源能力与 .mabel 包项目结构
 * [OUTPUT]: 对外提供 Leafer 图片编辑器初始化、按自然尺寸批量图片添加、分批项目加载、选中图片快速排版、指定位置粘贴、自动适配居中、项目导入导出、缩放和资源释放能力
 * [POS]: renderer/canvas 的画布领域逻辑，隔离 Leafer 状态与 Vue 组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { App, Image, PointerEvent } from 'leafer-editor'
import { computed, ref } from 'vue'
import { chunkItems } from './canvasBatching.mjs'
import { packImages } from './imagePacking.mjs'
import { destroyTreeChildren } from './leaferTreeLifecycle.mjs'
import { getContentBounds, getFitView } from './viewportFit.mjs'
import { MABEL_PROJECT_FORMAT_VERSION } from '../../../shared/mabelProject.mjs'

const GAP = 10
const ORIGIN = 10
const MIN_ZOOM = 0.001
const MAX_ZOOM = 1000
const ZOOM_FACTOR = 1.2
const FIT_PADDING = 48
const LOAD_BATCH_SIZE = 12

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

export function useLeaferImageEditor() {
  const app = ref(null)
  const files = ref([])
  const zoom = ref(1)
  const selectedImage = ref(null)
  const lastFileName = computed(() => files.value.at(-1)?.name || 'No image selected')
  const selectedOriginalPath = computed(() => selectedImage.value?.originalPath || '')
  const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)
  const imageCount = computed(() => files.value.length)
  const objectUrls = []
  let loadToken = 0

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
    releaseObjectUrls()
  }

  const mount = (view) => {
    app.value = new App({
      view,
      editor: {
        boxSelect: true,
        multipleSelect: true
      }
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

    return imageRecord
  }

  const applyView = ({ nextZoom, position }) => {
    zoom.value = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)

    if (app.value?.tree) {
      app.value.tree.scale = zoom.value
      app.value.tree.x = position.x
      app.value.tree.y = position.y
    }
  }

  const fitToContent = () => {
    if (!app.value || files.value.length === 0) return

    const rect = app.value.view.getBoundingClientRect()
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

  const getSelectedRecords = () => {
    const selectedNodes = new Set(app.value?.editor?.list || [])
    return files.value.filter((file) => selectedNodes.has(file.node))
  }

  const layoutSelectedImages = () => {
    const selectedRecords = getSelectedRecords()
    if (selectedRecords.length < 2) return 0

    const bounds = getContentBounds(
      selectedRecords.map((file) => ({
        x: file.node.x || 0,
        y: file.node.y || 0,
        width: file.node.width || 1,
        height: file.node.height || 1
      }))
    )
    const layout = packImages({
      items: selectedRecords.map((file) => ({
        width: file.node.width || 1,
        height: file.node.height || 1
      })),
      viewportWidth: Math.max(bounds.width, app.value.view.getBoundingClientRect().width),
      gap: GAP,
      origin: 0
    })

    selectedRecords.forEach((file, index) => {
      file.node.x = bounds.x + layout[index].x
      file.node.y = bounds.y + layout[index].y
    })

    return selectedRecords.length
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
      const source = await getImageSize(file)
      const assetId = getId('asset')
      const nodeId = getId('node')
      const bytes = await readFileAsBytes(file)
      const originalPath = window.api.files.getPath(file)

      sources.push({ assetId, bytes, file, nodeId, originalPath, source })
    }

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
      const source = await getImageSize(file)
      const assetId = getId('asset')
      const nodeId = getId('node')
      const bytes = await readFileAsBytes(file)
      const originalPath = window.api.files.getPath(file)
      const node = new Image({
        id: nodeId,
        url: source.url,
        x: point.x,
        y: nextY,
        width: source.width,
        height: source.height,
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
    }

    files.value = [...files.value, ...importedFiles]
    return importedFiles.length
  }

  const setZoom = (nextZoom) => {
    zoom.value = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)

    if (app.value?.tree) {
      app.value.tree.scale = zoom.value
    }
  }

  const zoomIn = () => setZoom(zoom.value * ZOOM_FACTOR)
  const zoomOut = () => setZoom(zoom.value / ZOOM_FACTOR)
  const resetZoom = () => setZoom(1)

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
      rotation: file.node.rotation || 0,
      opacity: file.node.opacity ?? 1,
      visible: file.node.visible ?? true,
      locked: file.node.locked ?? false
    }))
  })

  const loadProject = async (project, onProgress = () => {}) => {
    if (!app.value) return

    clearCanvas()
    const currentLoadToken = loadToken
    setZoom(project.canvas?.zoom || 1)

    const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
    const importedFiles = []
    const imageNodes = project.nodes.filter((projectNode) => projectNode.type === 'image')
    let loadedCount = 0

    for (const batch of chunkItems(imageNodes, LOAD_BATCH_SIZE)) {
      if (currentLoadToken !== loadToken) return

      for (const projectNode of batch) {
        const asset = assetMap.get(projectNode.assetId)
        if (!asset) continue

        const bytes = asset.bytes || base64ToBytes(asset.data)
        const url = bytesToObjectUrl(bytes, asset.mime)
        const node = new Image({
          id: projectNode.id,
          url,
          x: projectNode.x,
          y: projectNode.y,
          width: projectNode.width,
          height: projectNode.height,
          rotation: projectNode.rotation,
          opacity: projectNode.opacity,
          visible: projectNode.visible,
          locked: projectNode.locked,
          draggable: !projectNode.locked,
          editable: !projectNode.locked
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
      files.value = [...importedFiles]
      onProgress({ loaded: loadedCount, total: imageNodes.length })
      await nextFrame()
    }

    if (currentLoadToken !== loadToken) return
    files.value = importedFiles
    fitToContent()
  }

  const destroy = () => {
    clearCanvas()
    app.value?.destroy()
    app.value = null
  }

  return {
    addFiles,
    destroy,
    exportProject,
    imageCount,
    lastFileName,
    layoutSelectedImages,
    loadProject,
    mount,
    pasteFilesAt,
    resetZoom,
    selectedOriginalPath,
    showSelectedInFolder: () => window.api.files.showInFolder(selectedOriginalPath.value),
    zoomIn,
    zoomLabel,
    zoomOut
  }
}
