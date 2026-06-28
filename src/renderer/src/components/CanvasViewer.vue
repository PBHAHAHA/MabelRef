<script setup>
/**
 * [INPUT]: 依赖 useLeaferImageEditor、clipboardImages、focusMode prop 与用户拖入/粘贴的本地图片 File
 * [OUTPUT]: 对外提供基于 Leafer Editor 的多图片画布查看器、专注模式画布、按鼠标位置粘贴图片、选中图片快捷排版、原始路径定位、状态更新与项目快照读写能力
 * [POS]: renderer/components 的核心画布容器，被 App.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getCanvasShortcut } from '../canvas/canvasShortcuts.mjs'
import { getClipboardImageFiles } from '../canvas/clipboardImages.mjs'
import { useLeaferImageEditor } from '../canvas/useLeaferImageEditor'

const emit = defineEmits(['image-loaded', 'save-project'])

defineProps({
  focusMode: {
    type: Boolean,
    default: false
  }
})

const editorHost = ref(null)
const isDragging = ref(false)
const lastPointer = ref(null)
const statusText = ref('')
const editor = useLeaferImageEditor()

const importFiles = async (files) => {
  const count = await editor.addFiles(files)

  if (count > 0) emit('image-loaded', count)
  return count
}

const handleDrop = async (event) => {
  event.preventDefault()
  isDragging.value = false
  const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/'))
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
  if (count > 0) statusText.value = 'Pasted'
}

const handlePointerMove = (event) => {
  lastPointer.value = { x: event.clientX, y: event.clientY }
}

const handleDragOver = (event) => {
  event.preventDefault()
  isDragging.value = true
}

const handleWheel = (event) => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  if (event.deltaY > 0) editor.zoomOut()
  else editor.zoomIn()
}

const handleKeydown = (event) => {
  const shortcut = getCanvasShortcut(event)
  if (!shortcut) return

  event.preventDefault()
  if (shortcut === 'save') {
    emit('save-project')
    return
  }

  const count = editor.layoutSelectedImages()
  if (count > 0) statusText.value = `Arranged ${count}`
}

const showSelectedInFolder = async () => {
  await editor.showSelectedInFolder()
}

const getProject = () => editor.exportProject()

const loadProject = async (project) => {
  const total = project.nodes.filter((node) => node.type === 'image').length
  statusText.value = total > 0 ? `Loading 0/${total}` : 'Loading'
  await editor.loadProject(project, ({ loaded, total }) => {
    statusText.value = `Loading ${loaded}/${total}`
  })
  statusText.value = 'Opened'
}

const markSaved = () => {
  statusText.value = 'Saved'
}

defineExpose({
  getProject,
  loadProject,
  markSaved
})

onMounted(() => {
  editor.mount(editorHost.value)
  editorHost.value?.parentElement?.focus()
})

onBeforeUnmount(() => {
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
      <div>
        <p>Leafer Editor</p>
        <strong>{{ editor.lastFileName }}</strong>
        <button
          v-if="editor.selectedOriginalPath"
          type="button"
          class="image-origin-path"
          title="打开所在文件夹"
          @click="showSelectedInFolder"
        >
          {{ editor.selectedOriginalPath }}
        </button>
      </div>

      <div class="viewer-actions">
        <span v-if="statusText" class="project-status">{{ statusText }}</span>
        <div class="zoom-controls" aria-label="画布缩放">
          <button type="button" title="缩小" @click="editor.zoomOut">-</button>
          <span>{{ editor.zoomLabel }}</span>
          <button type="button" title="放大" @click="editor.zoomIn">+</button>
          <button type="button" title="重置缩放" @click="editor.resetZoom">Reset</button>
        </div>
      </div>
    </div>

    <div ref="editorHost" class="image-canvas"></div>
  </section>
</template>
