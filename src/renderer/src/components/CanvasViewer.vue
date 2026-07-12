<script setup>
/**
 * [INPUT]: 依赖 useLeaferImageEditor、clipboardImages、directoryEntries、focusMode prop 与用户拖入/粘贴的本地图片 File、图片文件夹或 .mabel File
 * [OUTPUT]: 对外提供基于 Leafer Editor 的多图片画布查看器、拖拽导入文件/文件夹/打开项目引导、专注模式画布、按鼠标位置粘贴图片、选中图片快捷排版、原始路径定位、加载保存状态与项目快照读写能力
 * [POS]: renderer/components 的核心画布容器，被 App.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FolderUp, Maximize, Sparkles, X } from 'lucide-vue-next'
import logoUrl from '../assets/logo1.png'
import { getCanvasShortcut } from '../canvas/canvasShortcuts.mjs'
import { getDroppedMabelProjectPath, getImageFiles } from '../canvas/canvasImportFiles.mjs'
import { getClipboardImageFiles } from '../canvas/clipboardImages.mjs'
import { collectDroppedFiles } from '../canvas/directoryEntries.mjs'
import { getWheelZoomFactor } from '../canvas/viewportZoom.mjs'
import { useLeaferImageEditor } from '../canvas/useLeaferImageEditor'

const emit = defineEmits([
  'image-loaded',
  'open-project-file',
  'save-project',
  'selected-image-change',
  'set-workspace'
])

const props = defineProps({
  focusMode: {
    type: Boolean,
    default: false
  },
  shortcuts: {
    type: Object,
    default: () => ({})
  },
  hasWorkspace: {
    type: Boolean,
    default: false
  }
})

const editorHost = ref(null)
const isDragging = ref(false)
const lastPointer = ref(null)
const saveProgress = ref(null)
const statusText = ref('')
const imageContextMenu = ref(null)
const aiEditDialog = ref(null)
const aiEditPrompt = ref('')
const aiEditStatus = ref('')
const isAiEditing = ref(false)
const isCanvasWindowDragging = ref(false)
const canvasWindowDragPointerId = ref(null)
const editor = useLeaferImageEditor()
const SETTINGS_STORAGE_KEY = 'mabelref.settings'
const SHOW_AI_FEATURES = false
let pendingWheelDelta = 0
let pendingWheelPoint = null
let pendingWheelFrame = 0

const importFiles = async (files) => {
  const count = await editor.addFiles(files)

  if (count > 0) emit('image-loaded', count)
  return count
}

const handleDrop = async (event) => {
  event.preventDefault()
  isDragging.value = false
  const projectPath = getDroppedMabelProjectPath(
    [...event.dataTransfer.files],
    window.api.files.getPath
  )

  if (projectPath) {
    emit('open-project-file', projectPath)
    return
  }

  const droppedFiles = await collectDroppedFiles(event.dataTransfer)
  await importFiles(getImageFiles(droppedFiles))
}

const handlePaste = async (event) => {
  const files = getClipboardImageFiles(event.clipboardData)
  if (files.length === 0) return

  event.preventDefault()
  const rect = editorHost.value.getBoundingClientRect()
  const fallbackPoint = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }
  const count = await editor.pasteFilesAt(files, lastPointer.value || fallbackPoint)

  if (count > 0) emit('image-loaded', count)
}

const handlePointerMove = (event) => {
  lastPointer.value = { x: event.clientX, y: event.clientY }
}

const closeImageContextMenu = () => {
  imageContextMenu.value = null
}

const endCanvasWindowDrag = () => {
  if (!isCanvasWindowDragging.value) return

  if (canvasWindowDragPointerId.value !== null) {
    const panel = editorHost.value?.parentElement
    if (panel?.hasPointerCapture?.(canvasWindowDragPointerId.value)) {
      panel.releasePointerCapture(canvasWindowDragPointerId.value)
    }
  }
  canvasWindowDragPointerId.value = null
  isCanvasWindowDragging.value = false
  window.api.windowControls.endCanvasDrag()
}

const handlePointerDown = async (event) => {
  if (event.button !== 2) return

  event.preventDefault()
  closeImageContextMenu()
  const dragStarted = await window.api.windowControls.beginCanvasDrag()
  if (!dragStarted) return

  isCanvasWindowDragging.value = true
  canvasWindowDragPointerId.value = event.pointerId
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

const handleCanvasContextMenu = (event) => {
  event.preventDefault()
  if (isCanvasWindowDragging.value) return
  if (!SHOW_AI_FEATURES) return

  const image = editor.selectImageAtClientPoint({ x: event.clientX, y: event.clientY })
  if (!image || props.focusMode) {
    closeImageContextMenu()
    return
  }

  imageContextMenu.value = {
    x: event.clientX,
    y: event.clientY,
    imageName: image.name,
    nodeId: image.nodeId
  }
}

const openAiEditDialog = () => {
  if (!imageContextMenu.value) return

  aiEditDialog.value = {
    imageName: imageContextMenu.value.imageName,
    nodeId: imageContextMenu.value.nodeId
  }
  aiEditPrompt.value = ''
  aiEditStatus.value = ''
  closeImageContextMenu()
}

const closeAiEditDialog = () => {
  if (isAiEditing.value) return

  aiEditDialog.value = null
  aiEditPrompt.value = ''
  aiEditStatus.value = ''
}

const getAiSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')?.ai || {}
  } catch {
    return {}
  }
}

const submitAiEditPrompt = async () => {
  if (!aiEditPrompt.value.trim()) return
  if (!aiEditDialog.value) return

  const settings = getAiSettings()
  const image = editor.getImageEditSource(aiEditDialog.value.nodeId)
  if (!image) {
    aiEditStatus.value = '找不到这张图片'
    return
  }

  isAiEditing.value = true
  aiEditStatus.value = '正在生成'

  try {
    const result = await window.api.ai.editImage({
      settings,
      image,
      prompt: aiEditPrompt.value
    })
    await editor.replaceImageWithBytes({
      nodeId: aiEditDialog.value.nodeId,
      bytes: result.bytes,
      mime: result.mime
    })
    aiEditStatus.value = '已完成'
    isAiEditing.value = false
    closeAiEditDialog()
  } catch (error) {
    aiEditStatus.value = error?.message || 'AI 修改失败'
  } finally {
    isAiEditing.value = false
  }
}

const handleDragOver = (event) => {
  event.preventDefault()
  isDragging.value = true
}

const handleWheel = (event) => {
  event.preventDefault()

  pendingWheelDelta += event.deltaY
  pendingWheelPoint = { x: event.clientX, y: event.clientY }

  if (pendingWheelFrame) return

  pendingWheelFrame = requestAnimationFrame(() => {
    const factor = getWheelZoomFactor(pendingWheelDelta)
    const point = pendingWheelPoint

    pendingWheelDelta = 0
    pendingWheelPoint = null
    pendingWheelFrame = 0

    if (point) editor.zoomAtFactor(factor, point)
  })
}

const handleKeydown = (event) => {
  const shortcut = getCanvasShortcut(event, props.shortcuts)
  if (!shortcut) return

  event.preventDefault()
  closeImageContextMenu()
  if (shortcut === 'save') {
    emit('save-project')
    return
  }

  if (shortcut === 'undo') {
    editor.undo()
    return
  }

  if (shortcut === 'redo') {
    editor.redo()
    return
  }

  if (shortcut === 'delete') {
    const deletedCount = editor.deleteSelectedImages()
    if (deletedCount > 0) emit('image-loaded', -deletedCount)
    return
  }

  if (shortcut === 'layer-up') {
    editor.moveSelectedImagesLayer(1)
    return
  }

  if (shortcut === 'layer-down') {
    editor.moveSelectedImagesLayer(-1)
    return
  }

  if (shortcut === 'arrange') {
    editor.layoutSelectedImages()
  }
}

const showSelectedInFolder = async () => {
  await editor.showSelectedInFolder()
}

const getProject = () => editor.exportProject()

const loadProject = async (project) => {
  const total = project.nodes.filter((node) => node.type === 'image').length
  statusText.value = total > 0 ? `正在加载 0/${total}` : '正在加载'
  await editor.loadProject(project, ({ loaded, total }) => {
    statusText.value = `正在加载 ${loaded}/${total}`
  })
  statusText.value = ''
}

const markSaved = () => {
  saveProgress.value = null
  statusText.value = ''
}

const markSaveCanceled = () => {
  saveProgress.value = null
  statusText.value = ''
}

const markSaving = () => {
  statusText.value = '正在保存'
  saveProgress.value = 0
}

const updateSaveProgress = (progress) => {
  if (!progress) return

  const total = Math.max(1, progress.totalEntries || 1)
  const written = Math.min(total, progress.writtenEntries || 0)
  saveProgress.value = progress.phase === 'done' ? 100 : Math.round((written / total) * 100)
  statusText.value = `正在保存 ${saveProgress.value}%`
}

defineExpose({
  getProject,
  isGrayscaleEnabled: editor.isGrayscaleEnabled,
  loadProject,
  markSaved,
  markSaveCanceled,
  markSaving,
  showSelectedInFolder,
  toggleAllImagesGrayscale: editor.toggleAllImagesGrayscale,
  updateSaveProgress
})

watch(
  () => editor.selectedImageName.value,
  (name) => {
    emit('selected-image-change', name)
  }
)

watch(
  () => editor.imageContextMenuRequest.value,
  (request) => {
    if (!SHOW_AI_FEATURES) return
    if (!request || props.focusMode) return

    imageContextMenu.value = {
      x: request.x,
      y: request.y,
      imageName: request.imageName,
      nodeId: request.nodeId
    }
  }
)

onMounted(() => {
  editor.mount(editorHost.value)
  editorHost.value?.parentElement?.focus()
})

onBeforeUnmount(() => {
  if (pendingWheelFrame) cancelAnimationFrame(pendingWheelFrame)
  endCanvasWindowDrag()
  editor.destroy()
})
</script>

<template>
  <section
    class="viewer-panel"
    :class="{ dragging: isDragging }"
    tabindex="0"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="isDragging = false"
    @paste="handlePaste"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="endCanvasWindowDrag"
    @pointercancel="endCanvasWindowDrag"
    @pointerleave="endCanvasWindowDrag"
    @contextmenu="handleCanvasContextMenu"
    @click="closeImageContextMenu"
    @wheel="handleWheel"
    @keydown="handleKeydown"
  >
    <div v-if="!focusMode" class="viewer-toolbar">
      <div class="viewer-toolbar-spacer"></div>

      <div class="viewer-actions">
        <div v-if="saveProgress !== null" class="save-progress" aria-label="保存进度">
          <span :style="{ width: `${saveProgress}%` }"></span>
        </div>
        <span v-if="statusText" class="project-status">{{ statusText }}</span>
      </div>
    </div>

    <div
      v-if="SHOW_AI_FEATURES && imageContextMenu"
      class="canvas-image-context-menu"
      :style="{ left: `${imageContextMenu.x}px`, top: `${imageContextMenu.y}px` }"
      @click.stop
      @contextmenu.stop.prevent
    >
      <button type="button" @click="openAiEditDialog">
        <Sparkles :size="15" :stroke-width="2" />
        <span>AI 修改</span>
      </button>
    </div>

    <div
      v-if="SHOW_AI_FEATURES && aiEditDialog"
      class="canvas-ai-edit-backdrop"
      @click.self="closeAiEditDialog"
      @contextmenu.stop.prevent
    >
      <form class="canvas-ai-edit-dialog" @submit.prevent="submitAiEditPrompt">
        <div class="canvas-ai-edit-header">
          <div>
            <p>AI 修改</p>
            <span>{{ aiEditDialog.imageName }}</span>
          </div>
          <button type="button" title="关闭" aria-label="关闭" @click="closeAiEditDialog">
            <X :size="16" :stroke-width="2" />
          </button>
        </div>

        <textarea
          v-model="aiEditPrompt"
          rows="5"
          autofocus
          placeholder="输入你想怎么修改这张图"
          :disabled="isAiEditing"
        ></textarea>

        <div class="canvas-ai-edit-footer">
          <span>{{ aiEditStatus }}</span>
          <button type="submit" :disabled="!aiEditPrompt.trim() || isAiEditing">
            {{ isAiEditing ? '生成中' : '生成修改' }}
          </button>
        </div>
      </form>
    </div>

    <div
      ref="editorHost"
      class="image-canvas"
      :class="{ grayscale: editor.isGrayscaleEnabled.value }"
    ></div>
    <button
      v-if="editor.imageCount.value > 0"
      type="button"
      class="canvas-reset-view"
      title="归位到全部图片"
      aria-label="归位到全部图片"
      @click="editor.resetView"
    >
      <Maximize :size="17" :stroke-width="2" />
    </button>
    <div v-if="!focusMode && editor.imageCount.value === 0" class="canvas-empty-import">
      <img class="empty-import-logo" :src="logoUrl" alt="" aria-hidden="true" />
      <p>拖入图片、文件夹或 MabelRef 项目</p>
      <span>支持 JPG、PNG、WEBP 等常见图片格式，也支持包含图片的文件夹和 .mabel 项目文件</span>
      <button
        v-if="!hasWorkspace"
        type="button"
        class="canvas-workspace-button"
        @click="emit('set-workspace')"
      >
        <FolderUp class="empty-import-button-icon" :size="15" :stroke-width="2" />
        <span>设置工作空间</span>
      </button>
    </div>
  </section>
</template>
