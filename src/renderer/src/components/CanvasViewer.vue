<script setup>
/**
 * [INPUT]: 依赖 useLeaferImageEditor、clipboardImages、focusMode prop 与用户拖入/粘贴/浏览选择的本地图片 File 或 .mabel File
 * [OUTPUT]: 对外提供基于 Leafer Editor 的多图片画布查看器、首次打开拖拽导入/打开项目引导、专注模式画布、按鼠标位置粘贴图片、选中图片快捷排版、原始路径定位、加载保存状态与项目快照读写能力
 * [POS]: renderer/components 的核心画布容器，被 App.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Maximize } from 'lucide-vue-next'
import logoUrl from '../assets/logo1.png'
import { getCanvasShortcut } from '../canvas/canvasShortcuts.mjs'
import { getDroppedMabelProjectPath, getImageFiles } from '../canvas/canvasImportFiles.mjs'
import { getClipboardImageFiles } from '../canvas/clipboardImages.mjs'
import { getWheelZoomFactor } from '../canvas/viewportZoom.mjs'
import { useLeaferImageEditor } from '../canvas/useLeaferImageEditor'

const emit = defineEmits(['image-loaded', 'open-project-file', 'save-project', 'selected-image-change'])

defineProps({
  focusMode: {
    type: Boolean,
    default: false
  }
})

const editorHost = ref(null)
const fileInput = ref(null)
const isDragging = ref(false)
const lastPointer = ref(null)
const saveProgress = ref(null)
const statusText = ref('')
const editor = useLeaferImageEditor()
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
  const droppedFiles = [...event.dataTransfer.files]
  const projectPath = getDroppedMabelProjectPath(droppedFiles, window.api.files.getPath)

  if (projectPath) {
    emit('open-project-file', projectPath)
    return
  }

  await importFiles(getImageFiles(droppedFiles))
}

const browseFiles = () => {
  fileInput.value?.click()
}

const handleFileInput = async (event) => {
  const files = getImageFiles([...event.target.files])

  event.target.value = ''
  await importFiles(files)
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

const handleDragOver = (event) => {
  event.preventDefault()
  isDragging.value = true
}

const handleWheel = (event) => {
  event.preventDefault()

  if (!event.ctrlKey && !event.metaKey) {
    editor.panByWheelDelta({ x: event.deltaX, y: event.deltaY })
    return
  }

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
  const shortcut = getCanvasShortcut(event)
  if (!shortcut) return

  event.preventDefault()
  if (shortcut === 'save') {
    emit('save-project')
    return
  }

  if (shortcut === 'undo') {
    editor.undo()
    return
  }

  editor.layoutSelectedImages()
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

onMounted(() => {
  editor.mount(editorHost.value)
  editorHost.value?.parentElement?.focus()
})

onBeforeUnmount(() => {
  if (pendingWheelFrame) cancelAnimationFrame(pendingWheelFrame)
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
    @pointermove="handlePointerMove"
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
      <p>拖入图片或 MabelRef 项目</p>
      <span>支持 JPG、PNG、WEBP 等常见图片格式，也支持 .mabel 项目文件</span>
      <button type="button" @click="browseFiles">浏览文件</button>
    </div>
    <input
      ref="fileInput"
      class="canvas-file-input"
      type="file"
      accept="image/*"
      multiple
      @change="handleFileInput"
    />
  </section>
</template>
