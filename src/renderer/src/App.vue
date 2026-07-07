<script setup>
/**
 * [INPUT]: 依赖 CanvasViewer 组件、createEmptyMabelProject 与 preload 暴露的 windowControls/project API
 * [OUTPUT]: 对外提供图片查看器根组件、画布专注模式、直接新建/打开/保存 .mabel 项目文件和 Windows 风格窗口控制栏
 * [POS]: renderer 根组件，组织窗口壳与单画布项目文件工作流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  FilePlus2,
  FolderSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileImage,
  Folder,
  Lightbulb,
  Briefcase,
  GraduationCap,
  Contrast,
  Settings,
  X
} from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { createEmptyMabelProject } from '../../shared/mabelProject.mjs'
import CanvasViewer from './components/CanvasViewer.vue'
import {
  formatShortcut,
  getEventShortcut,
  getShortcutAction,
  getShortcutSettings,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS
} from './shortcuts.mjs'

const isMaximized = ref(false)
const canvasViewer = ref(null)
const canvasSessionId = ref(0)
const activeProjectPath = ref('')
const imageCount = ref(0)
const projectError = ref('')
const projectName = ref('未命名')
const selectedImageName = ref('')
const isCanvasFocusMode = ref(false)
const isWindowPinned = ref(false)
const isCanvasGrayscale = ref(false)
const isTopBarVisible = ref(false)
const isTopBarDragging = ref(false)
const isLibraryOpen = ref(false)
const library = ref({ recentProjects: [], categories: [] })
const contextMenu = ref(null)
const isSettingsDialogOpen = ref(false)
const settingsSaveStatus = ref('')
const shortcutCaptureAction = ref('')
const shortcutSettings = ref(getShortcutSettings())
const aiSettings = ref({
  endpoint: 'https://api.lk888.ai',
  model: 'gpt-image-2',
  apiKey: '',
  size: 'auto',
  quality: 'auto'
})
const isCreatingCategory = ref(false)
const newCategoryName = ref('')
const newCategoryInput = ref(null)
const editingLibraryItem = ref(null)
const editingLibraryName = ref('')
let projectOpenRequestId = 0
const SETTINGS_STORAGE_KEY = 'mabelref.settings'
const SHOW_AI_FEATURES = false

const collapsedCategories = ref({})
const toggleCategoryCollapse = (categoryId) => {
  collapsedCategories.value[categoryId] = !collapsedCategories.value[categoryId]
}

const getCategoryStyle = (name) => {
  const lower = name.toLowerCase()
  if (lower.includes('灵感') || lower.includes('idea') || lower.includes('inspire')) {
    return {
      icon: Lightbulb,
      color: '#8fbe98',
      bg: 'rgba(111, 167, 122, 0.13)'
    }
  }
  if (lower.includes('素材') || lower.includes('asset') || lower.includes('design') || lower.includes('设计')) {
    return {
      icon: Briefcase,
      color: '#88b3a2',
      bg: 'rgba(113, 156, 139, 0.13)'
    }
  }
  if (lower.includes('教程') || lower.includes('course') || lower.includes('learn') || lower.includes('study') || lower.includes('figma')) {
    return {
      icon: GraduationCap,
      color: '#9caf88',
      bg: 'rgba(139, 160, 121, 0.13)'
    }
  }
  return {
    icon: Folder,
    color: '#909b96',
    bg: 'rgba(143, 179, 158, 0.09)'
  }
}

const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const getRequestId = () => crypto.randomUUID()

const minimizeWindow = () => window.api.windowControls.minimize()
const toggleMaximizeWindow = async () => {
  isMaximized.value = await window.api.windowControls.toggleMaximize()
}
const closeWindow = () => window.api.windowControls.close()

const refreshLibrary = async () => {
  library.value = await window.api.library.get()
}

const toggleLibrarySidebar = () => {
  isLibraryOpen.value = !isLibraryOpen.value
  if (!isLibraryOpen.value) {
    closeLibraryContextMenu()
    cancelCreateCategory()
  }
}

const isEditableShortcutTarget = (target) => {
  const tagName = target?.tagName?.toLowerCase()

  return tagName === 'input' || tagName === 'textarea' || target?.isContentEditable
}

const handleWindowKeydown = (event) => {
  if (shortcutCaptureAction.value) {
    event.preventDefault()
    setShortcutFromEvent(event)
    return
  }

  if (event.key === 'Escape' && isSettingsDialogOpen.value) {
    event.preventDefault()
    isSettingsDialogOpen.value = false
    return
  }

  if (getShortcutAction(event, shortcutSettings.value) !== 'sidebar') return
  if (isEditableShortcutTarget(event.target)) return

  event.preventDefault()
  toggleLibrarySidebar()
}

const toggleWindowPin = async () => {
  isWindowPinned.value = await window.api.windowControls.togglePin()
}

const openSettingsDialog = () => {
  closeLibraryContextMenu()
  settingsSaveStatus.value = ''
  isSettingsDialogOpen.value = true
}

const closeSettingsDialog = () => {
  isSettingsDialogOpen.value = false
  settingsSaveStatus.value = ''
  shortcutCaptureAction.value = ''
}

const normalizeAiEndpoint = (endpoint) => {
  const normalized = String(endpoint || '').trim().replace(/\/+$/, '')

  if (!normalized) return 'https://api.lk888.ai'
  if (normalized.endsWith('/v1/images/edits')) {
    return normalized.slice(0, -'/v1/images/edits'.length) || 'https://api.lk888.ai'
  }
  if (normalized.endsWith('/v1/images/generations')) {
    return normalized.slice(0, -'/v1/images/generations'.length) || 'https://api.lk888.ai'
  }
  if (normalized.endsWith('/v1/media/generate')) {
    return normalized.slice(0, -'/v1/media/generate'.length) || 'https://api.lk888.ai'
  }
  if (normalized.endsWith('/v1')) {
    return normalized.slice(0, -'/v1'.length) || 'https://api.lk888.ai'
  }
  return normalized
}

const loadSettings = () => {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')

    shortcutSettings.value = getShortcutSettings(settings.shortcuts)
    aiSettings.value = {
      endpoint: normalizeAiEndpoint(settings.ai?.endpoint),
      model: settings.ai?.model || 'gpt-image-2',
      apiKey: settings.ai?.apiKey || '',
      size: settings.ai?.size || 'auto',
      quality: settings.ai?.quality || 'auto'
    }
  } catch {
    shortcutSettings.value = getShortcutSettings()
    aiSettings.value = {
      endpoint: 'https://api.lk888.ai',
      model: 'gpt-image-2',
      apiKey: '',
      size: 'auto',
      quality: 'auto'
    }
  }
}

const persistSettings = () => {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ai: {
        endpoint: normalizeAiEndpoint(aiSettings.value.endpoint),
        model: aiSettings.value.model.trim(),
        apiKey: aiSettings.value.apiKey,
        size: aiSettings.value.size,
        quality: aiSettings.value.quality
      },
      shortcuts: shortcutSettings.value
    })
  )
}

const saveSettings = () => {
  aiSettings.value.endpoint = normalizeAiEndpoint(aiSettings.value.endpoint)
  aiSettings.value.model = aiSettings.value.model.trim()
  persistSettings()
  settingsSaveStatus.value = '已保存'
}

const startShortcutCapture = (action) => {
  shortcutCaptureAction.value = action
  settingsSaveStatus.value = '按下新的快捷键'
}

const setShortcutFromEvent = (event) => {
  const shortcut = getEventShortcut(event)
  if (!shortcut) return
  if (shortcut === 'Escape') {
    shortcutCaptureAction.value = ''
    settingsSaveStatus.value = ''
    return
  }

  shortcutSettings.value = {
    ...shortcutSettings.value,
    [shortcutCaptureAction.value]: shortcut
  }
  shortcutCaptureAction.value = ''
  persistSettings()
  settingsSaveStatus.value = '已保存'
}

const resetShortcuts = () => {
  shortcutSettings.value = getShortcutSettings()
  persistSettings()
  settingsSaveStatus.value = '已恢复默认'
}

const setCanvasFocusMode = async (enabled) => {
  isCanvasFocusMode.value = await window.api.windowControls.setCanvasFocusMode(enabled)
  isTopBarVisible.value = false
}

const showTopBar = () => {
  isTopBarVisible.value = true
}

const hideTopBar = () => {
  if (isTopBarDragging.value) return
  isTopBarVisible.value = false
}

const handleShellPointerMove = (event) => {
  if (event.clientY <= 72) {
    showTopBar()
  } else if (event.clientY > 96 && !isTopBarDragging.value) {
    hideTopBar()
  }
}

const handleTitlebarPointerDown = (event) => {
  if (event.button !== 0) return

  isTopBarDragging.value = true
  showTopBar()
}

const handleTitlebarPointerUp = (event) => {
  isTopBarDragging.value = false
  if (event.clientY > 96) hideTopBar()
}

const handleWindowPointerUp = () => {
  isTopBarDragging.value = false
}

const handleImageLoaded = (count) => {
  imageCount.value = Math.max(0, imageCount.value + count)
}

const handleSelectedImageChange = (name) => {
  selectedImageName.value = name
}

const showSelectedImageInFolder = async () => {
  await canvasViewer.value?.showSelectedInFolder()
}

const loadProjectIntoCanvas = async ({ filePath = '', name = '未命名', project }, requestId) => {
  projectError.value = ''

  activeProjectPath.value = filePath
  projectName.value = name
  selectedImageName.value = ''
  isCanvasGrayscale.value =
    project.nodes.length > 0 &&
    project.nodes
      .filter((node) => node.type === 'image')
      .every((node) => Boolean(node.grayscale))
  imageCount.value = 0
  canvasSessionId.value += 1
  await nextTick()
  if (requestId !== projectOpenRequestId) return

  await canvasViewer.value.loadProject(project)
  imageCount.value = project.nodes.length
}

const createNewProject = async () => {
  const requestId = (projectOpenRequestId += 1)
  await loadProjectIntoCanvas({
    filePath: '',
    name: '未命名',
    project: createEmptyMabelProject()
  }, requestId)
}

const openProject = async () => {
  const requestId = (projectOpenRequestId += 1)
  projectError.value = ''

  let result
  try {
    result = await window.api.project.open()
    if (requestId !== projectOpenRequestId || result.canceled) return
  } catch (error) {
    if (requestId !== projectOpenRequestId) return
    projectError.value = error.message || '项目打开失败'
    return
  }

  await loadProjectIntoCanvas(result, requestId)
  await refreshLibrary()
}

const openProjectPath = async (filePath) => {
  const requestId = (projectOpenRequestId += 1)
  projectError.value = ''

  let result
  try {
    result = await window.api.project.openPath(filePath)
    if (requestId !== projectOpenRequestId || result.canceled) return
  } catch (error) {
    if (requestId !== projectOpenRequestId) return
    projectError.value = error.message || '项目打开失败'
    return
  }

  await loadProjectIntoCanvas(result, requestId)
  await refreshLibrary()
}

const saveProject = async () => {
  if (!canvasViewer.value) return
  canvasViewer.value.markSaving()
  await nextFrame()

  const requestId = getRequestId()
  const unsubscribe = window.api.project.onSaveProgress(requestId, (progress) => {
    canvasViewer.value?.updateSaveProgress(progress)
  })

  let result
  try {
    result = await window.api.project.save({
      filePath: activeProjectPath.value,
      requestId,
      project: canvasViewer.value.getProject()
    })
  } finally {
    unsubscribe()
  }

  if (result.canceled) {
    canvasViewer.value.markSaveCanceled()
    return
  }
  activeProjectPath.value = result.filePath
  projectName.value = result.name || projectName.value
  canvasViewer.value.markSaved()
  await refreshLibrary()
}

const toggleCanvasGrayscale = () => {
  isCanvasGrayscale.value = canvasViewer.value?.toggleAllImagesGrayscale() || false
}

const startCreateCategory = async () => {
  closeLibraryContextMenu()
  isCreatingCategory.value = true
  newCategoryName.value = ''
  await nextTick()
  newCategoryInput.value?.focus()
}

const cancelCreateCategory = () => {
  isCreatingCategory.value = false
  newCategoryName.value = ''
}

const submitCreateCategory = async () => {
  const name = newCategoryName.value.trim()
  if (!name) {
    cancelCreateCategory()
    return
  }

  library.value = await window.api.library.addCategory(name)
  cancelCreateCategory()
}

const focusLibraryEditInput = async () => {
  await nextTick()
  const input = document.querySelector('.library-rename-input')
  input?.focus()
  input?.select()
}

const startRenameLibraryCategory = async (category) => {
  editingLibraryItem.value = { type: 'category', key: category.id, category }
  editingLibraryName.value = category.name
  await focusLibraryEditInput()
}

const startRenameLibraryProject = async (project) => {
  editingLibraryItem.value = { type: 'project', key: project.path, project }
  editingLibraryName.value = project.name
  await focusLibraryEditInput()
}

const isEditingLibraryCategory = (category) =>
  editingLibraryItem.value?.type === 'category' && editingLibraryItem.value.key === category.id

const isEditingLibraryProject = (project) =>
  editingLibraryItem.value?.type === 'project' && editingLibraryItem.value.key === project.path

const cancelRenameLibraryItem = () => {
  editingLibraryItem.value = null
  editingLibraryName.value = ''
}

const submitRenameLibraryItem = async () => {
  const item = editingLibraryItem.value
  const name = editingLibraryName.value.trim()
  if (!item || !name) {
    cancelRenameLibraryItem()
    return
  }

  if (item.type === 'category') {
    library.value = await window.api.library.renameCategory(item.category.id, name)
    cancelRenameLibraryItem()
    return
  }

  if (name === item.project.name) {
    cancelRenameLibraryItem()
    return
  }

  try {
    const result = await window.api.library.renameProject(item.project.path, name)
    library.value = result.library

    if (item.project.path === activeProjectPath.value) {
      activeProjectPath.value = result.project.filePath
      projectName.value = result.project.name
    }
    projectError.value = ''
  } catch (error) {
    projectError.value = error.message || '文件重命名失败'
  } finally {
    cancelRenameLibraryItem()
  }
}

const removeLibraryCategory = async (category) => {
  if (!window.confirm(`删除分类「${category.name}」？不会删除真实 MabelRef 文件。`)) return

  library.value = await window.api.library.removeCategory(category.id)
}

const addProjectToLibraryCategory = async (category, project) => {
  library.value = await window.api.library.addProjectToCategory(category.id, {
    filePath: project.path,
    name: project.name
  })
}

const addCurrentProjectToCategory = async (category) => {
  if (!activeProjectPath.value) {
    projectError.value = '请先保存当前项目，再加入分类'
    return
  }

  await addProjectToLibraryCategory(category, {
    path: activeProjectPath.value,
    name: projectName.value
  })
}

const removeProjectFromLibraryCategory = async (category, project) => {
  library.value = await window.api.library.removeProjectFromCategory(category.id, project.path)
}

const showLibraryProjectInFolder = async (project) => {
  if (!project?.path) return
  await window.api.files.showInFolder(project.path)
}

const handleRecentDragStart = (event, project) => {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-mabel-project', JSON.stringify(project))
}

const handleCategoryDrop = async (event, category) => {
  event.preventDefault()

  const payload = event.dataTransfer.getData('application/x-mabel-project')
  if (!payload) return

  await addProjectToLibraryCategory(category, JSON.parse(payload))
}

const openLibraryContextMenu = (event, type, payload = {}) => {
  event.preventDefault()
  contextMenu.value = {
    type,
    payload,
    x: event.clientX,
    y: event.clientY
  }
}

const closeLibraryContextMenu = () => {
  contextMenu.value = null
}

const runContextAction = async (action) => {
  const menu = contextMenu.value
  closeLibraryContextMenu()
  if (!menu) return

  if (action === 'rename-category') await startRenameLibraryCategory(menu.payload.category)
  if (action === 'remove-category') await removeLibraryCategory(menu.payload.category)
  if (action === 'add-current') await addCurrentProjectToCategory(menu.payload.category)
  if (action === 'rename-project') await startRenameLibraryProject(menu.payload.project)
  if (action === 'show-project-folder') {
    await showLibraryProjectInFolder(menu.payload.project)
  }
  if (action === 'remove-project') {
    await removeProjectFromLibraryCategory(menu.payload.category, menu.payload.project)
  }
}

onMounted(() => {
  loadSettings()
  createNewProject()
  refreshLibrary()
  window.addEventListener('pointerup', handleWindowPointerUp)
  window.addEventListener('click', closeLibraryContextMenu)
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', handleWindowPointerUp)
  window.removeEventListener('click', closeLibraryContextMenu)
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <div
    class="window-shell"
    :class="{ 'canvas-focus-mode': isCanvasFocusMode }"
    @pointermove="handleShellPointerMove"
  >
    <header
      class="titlebar"
      :class="{ visible: isTopBarVisible || isTopBarDragging }"
      @pointerenter="showTopBar"
      @pointerleave="hideTopBar"
      @pointerdown="handleTitlebarPointerDown"
      @pointerup="handleTitlebarPointerUp"
      @pointercancel="handleTitlebarPointerUp"
    >
      <div class="titlebar-left">
        <button
          type="button"
          class="titlebar-menu-toggle"
          :aria-label="isLibraryOpen ? '收起菜单栏' : '展开菜单栏'"
          :title="isLibraryOpen ? '收起菜单栏' : '展开菜单栏'"
          @pointerdown.stop
          @click.stop="toggleLibrarySidebar"
        >
          <PanelLeftClose
            v-if="isLibraryOpen"
            class="window-control-icon"
            :stroke-width="1.8"
          />
          <PanelLeftOpen v-else class="window-control-icon" :stroke-width="1.8" />
        </button>
      </div>

      <button
        v-if="selectedImageName"
        type="button"
        class="titlebar-selected-image"
        title="打开所在文件夹"
        @click="showSelectedImageInFolder"
      >
        {{ selectedImageName }}
      </button>
      <div v-else class="titlebar-selected-placeholder" aria-hidden="true"></div>

      <nav class="window-controls" aria-label="窗口控制">
        <button
          type="button"
          aria-label="新建项目"
          title="新建项目"
          @click="createNewProject"
        >
          <FilePlus2 class="window-control-icon" />
        </button>
        <button
          type="button"
          :aria-label="isCanvasGrayscale ? '恢复彩色' : '转为黑白灰'"
          :disabled="imageCount === 0"
          :title="isCanvasGrayscale ? '恢复彩色' : '转为黑白灰'"
          @click="toggleCanvasGrayscale"
        >
          <Contrast
            class="window-control-icon"
            :class="{ active: isCanvasGrayscale }"
          />
        </button>
        <button type="button" aria-label="设置" title="设置" @click="openSettingsDialog">
          <Settings class="window-control-icon" />
        </button>
        <button
          type="button"
          :aria-label="isWindowPinned ? '取消置顶' : '置顶窗口'"
          :title="isWindowPinned ? '取消置顶' : '置顶窗口'"
          @click="toggleWindowPin"
        >
          <PinOff v-if="isWindowPinned" class="window-control-icon pin-icon active" />
          <Pin v-else class="window-control-icon pin-icon" />
        </button>
        <button type="button" aria-label="最小化" title="最小化" @click="minimizeWindow">
          <span class="minimize-icon"></span>
        </button>
        <button
          type="button"
          :aria-label="isMaximized ? '还原窗口' : '最大化窗口'"
          :title="isMaximized ? '还原' : '最大化'"
          @click="toggleMaximizeWindow"
        >
          <span :class="isMaximized ? 'restore-icon' : 'maximize-icon'"></span>
        </button>
        <button
          type="button"
          class="close-button"
          aria-label="关闭"
          title="关闭"
          @click="closeWindow"
        >
          <span class="close-icon"></span>
        </button>
      </nav>
    </header>

    <main
      class="image-viewer-layout"
      :class="{ 'library-hidden': isCanvasFocusMode || !isLibraryOpen }"
    >
      <aside
        v-if="!isCanvasFocusMode && isLibraryOpen"
        class="library-sidebar"
      >
        <p v-if="projectError" class="library-error">{{ projectError }}</p>

        <section class="library-section">
          <div class="library-section-header">
            <span>最近打开</span>
            <span class="section-count">{{ library.recentProjects.length }}</span>
          </div>
          <div class="library-section-items">
            <div
              v-for="project in library.recentProjects"
              :key="project.path"
              role="button"
              tabindex="0"
              class="library-project"
              :class="{ active: project.path === activeProjectPath }"
              draggable="true"
              :title="project.path"
              @click="!isEditingLibraryProject(project) && openProjectPath(project.path)"
              @keydown.enter.prevent="!isEditingLibraryProject(project) && openProjectPath(project.path)"
              @dragstart="handleRecentDragStart($event, project)"
              @contextmenu.stop="openLibraryContextMenu($event, 'project', { project })"
            >
              <span class="project-icon recent">
                <FileImage :size="14" :stroke-width="2" />
              </span>
              <input
                v-if="isEditingLibraryProject(project)"
                v-model="editingLibraryName"
                class="library-rename-input"
                type="text"
                @click.stop
                @keydown.enter.stop.prevent="submitRenameLibraryItem"
                @keydown.esc.stop.prevent="cancelRenameLibraryItem"
                @blur="submitRenameLibraryItem"
              />
              <span v-else class="project-name">{{ project.name }}</span>
            </div>
            <p v-if="library.recentProjects.length === 0" class="library-empty">还没有保存的项目</p>
          </div>
        </section>

        <section class="library-section">
          <div class="library-section-header">
            <span>分类</span>
            <button
              type="button"
              title="新建分类"
              aria-label="新建分类"
              @click="startCreateCategory"
            >
              <Plus :size="14" :stroke-width="2" />
            </button>
          </div>

          <input
            v-if="isCreatingCategory"
            ref="newCategoryInput"
            v-model="newCategoryName"
            class="library-category-input"
            type="text"
            placeholder="分类名称"
            @keydown.enter.prevent="submitCreateCategory"
            @keydown.esc.prevent="cancelCreateCategory"
            @blur="submitCreateCategory"
            @click.stop
          />

          <div
            v-for="category in library.categories"
            :key="category.id"
            class="library-category"
            :class="{ collapsed: collapsedCategories[category.id] }"
            @dragover.prevent
            @drop="handleCategoryDrop($event, category)"
            @contextmenu.stop="openLibraryContextMenu($event, 'category', { category })"
          >
            <div 
              class="library-category-header"
              @click="!isEditingLibraryCategory(category) && toggleCategoryCollapse(category.id)"
            >
              <span class="category-chevron">
                <ChevronDown v-if="!collapsedCategories[category.id]" :size="14" />
                <ChevronRight v-else :size="14" />
              </span>
              <span 
                class="category-icon-wrapper" 
                :style="{ color: getCategoryStyle(category.name).color, backgroundColor: getCategoryStyle(category.name).bg }"
              >
                <component :is="getCategoryStyle(category.name).icon" :size="14" :stroke-width="2" />
              </span>
              <input
                v-if="isEditingLibraryCategory(category)"
                v-model="editingLibraryName"
                class="library-rename-input"
                type="text"
                @click.stop
                @keydown.enter.stop.prevent="submitRenameLibraryItem"
                @keydown.esc.stop.prevent="cancelRenameLibraryItem"
                @blur="submitRenameLibraryItem"
              />
              <span v-else class="category-title">{{ category.name }}</span>
              <span class="category-count">{{ category.items?.length || 0 }}</span>
            </div>

            <!-- Nested items -->
            <div v-if="!collapsedCategories[category.id]" class="library-category-items">
              <div
                v-for="project in category.items"
                :key="`${category.id}:${project.path}`"
                role="button"
                tabindex="0"
                class="library-project nested"
                :class="{ active: project.path === activeProjectPath }"
                draggable="true"
                :title="project.path"
                @click="!isEditingLibraryProject(project) && openProjectPath(project.path)"
                @keydown.enter.prevent="!isEditingLibraryProject(project) && openProjectPath(project.path)"
                @dragstart="handleRecentDragStart($event, project)"
                @contextmenu.stop="
                  openLibraryContextMenu($event, 'category-project', { category, project })
                "
              >
                <span class="project-icon" :style="{ '--project-accent': getCategoryStyle(category.name).color }">
                  <FileImage :size="14" :stroke-width="2" />
                </span>
                <input
                  v-if="isEditingLibraryProject(project)"
                  v-model="editingLibraryName"
                  class="library-rename-input"
                  type="text"
                  @click.stop
                  @keydown.enter.stop.prevent="submitRenameLibraryItem"
                  @keydown.esc.stop.prevent="cancelRenameLibraryItem"
                  @blur="submitRenameLibraryItem"
                />
                <span v-else class="project-name">{{ project.name }}</span>
              </div>
            </div>
          </div>
          <p v-if="library.categories.length === 0" class="library-empty">右键或点加号新建分类</p>
        </section>
      </aside>

      <CanvasViewer
        :key="canvasSessionId"
        ref="canvasViewer"
        :focus-mode="isCanvasFocusMode"
        :shortcuts="shortcutSettings"
        @image-loaded="handleImageLoaded"
        @open-project-file="openProjectPath"
        @save-project="saveProject"
        @selected-image-change="handleSelectedImageChange"
      />
    </main>

    <div
      v-if="contextMenu"
      class="library-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button
        v-if="contextMenu.type === 'category'"
        type="button"
        @click="runContextAction('add-current')"
      >
        添加当前项目
      </button>
      <button
        v-if="contextMenu.type === 'category'"
        type="button"
        @click="runContextAction('rename-category')"
      >
        重命名分类
      </button>
      <button
        v-if="contextMenu.type === 'category'"
        type="button"
        class="danger"
        @click="runContextAction('remove-category')"
      >
        删除分类
      </button>
      <button
        v-if="contextMenu.type === 'project' || contextMenu.type === 'category-project'"
        type="button"
        @click="runContextAction('rename-project')"
      >
        重命名文件
      </button>
      <button
        v-if="contextMenu.type === 'project' || contextMenu.type === 'category-project'"
        type="button"
        @click="runContextAction('show-project-folder')"
      >
        <FolderSearch :size="13" :stroke-width="2" />
        打开文件夹
      </button>
      <button
        v-if="contextMenu.type === 'category-project'"
        type="button"
        class="danger"
        @click="runContextAction('remove-project')"
      >
        <Trash2 :size="13" :stroke-width="2" />
        从分类移除
      </button>
    </div>

    <div v-if="isSettingsDialogOpen" class="settings-backdrop" @click.self="closeSettingsDialog">
      <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <div>
            <h2 id="settings-title">设置</h2>
            <p>快捷键与 AI 配置</p>
          </div>
          <button type="button" aria-label="关闭设置" title="关闭设置" @click="closeSettingsDialog">
            <X :size="16" :stroke-width="2" />
          </button>
        </header>

        <div class="settings-content">
          <section class="settings-section">
            <div class="settings-section-title">
              <h3>快捷键</h3>
              <button type="button" class="settings-text-button" @click="resetShortcuts">恢复默认</button>
            </div>
            <div class="shortcut-list">
              <button
                v-for="action in SHORTCUT_ACTIONS"
                :key="action"
                type="button"
                :class="{ capturing: shortcutCaptureAction === action }"
                @click="startShortcutCapture(action)"
              >
                <span>{{ SHORTCUT_LABELS[action] }}</span>
                <kbd>{{ shortcutCaptureAction === action ? '请按键' : formatShortcut(shortcutSettings[action]) }}</kbd>
              </button>
            </div>
          </section>

          <form v-if="SHOW_AI_FEATURES" class="settings-section" @submit.prevent="saveSettings">
            <div class="settings-section-title">
              <h3>AI 设置</h3>
              <span>{{ settingsSaveStatus || '本地保存' }}</span>
            </div>
            <label class="settings-field">
              <span>服务地址</span>
              <input
                v-model="aiSettings.endpoint"
                type="url"
                placeholder="https://api.example.com"
              />
            </label>
            <label class="settings-field">
              <span>模型</span>
              <input v-model="aiSettings.model" type="text" placeholder="gpt-image-2" />
            </label>
            <div class="settings-field-grid">
              <label class="settings-field">
                <span>图片尺寸</span>
                <select v-model="aiSettings.size">
                  <option value="auto">auto</option>
                  <option value="1024x1024">1024x1024</option>
                  <option value="1024x1536">1024x1536</option>
                  <option value="1536x1024">1536x1024</option>
                  <option value="2048x2048">2048x2048</option>
                  <option value="2048x3072">2048x3072</option>
                  <option value="3072x2048">3072x2048</option>
                </select>
              </label>
              <label class="settings-field">
                <span>图片质量</span>
                <select v-model="aiSettings.quality">
                  <option value="auto">auto</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
            </div>
            <label class="settings-field">
              <span>API Key</span>
              <input v-model="aiSettings.apiKey" type="password" placeholder="用于 AI 图片修改" />
            </label>
            <div class="settings-actions">
              <span>配置会保存在本机</span>
              <button type="submit">保存设置</button>
            </div>
          </form>
        </div>
      </section>
    </div>

    <div v-if="isCanvasFocusMode" class="canvas-window-drag top" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag right" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag bottom" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag left" aria-hidden="true"></div>
  </div>
</template>
