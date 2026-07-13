<script setup>
/**
 * [INPUT]: 依赖 CanvasViewer 组件、createEmptyMabelProject 与 preload 暴露的 windowControls/project/library API
 * [OUTPUT]: 对外提供图片查看器根组件、工作空间设置、分类管理、画布专注模式、直接新建/打开/保存 .mabel 项目文件和 Windows 风格窗口控制栏
 * [POS]: renderer 根组件，组织窗口壳与单画布项目文件工作流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  FilePlus2,
  FolderSearch,
  FolderUp,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
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
import appLogo from './assets/logo1.png'
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
const pendingProjectPath = ref('')
const imageCount = ref(0)
const projectError = ref('')
const projectName = ref('未命名')
const selectedImageName = ref('')
const isCanvasFocusMode = ref(false)
const isWindowPinned = ref(false)
const isCanvasGrayscale = ref(false)
const isTopBarVisible = ref(false)
const isTopBarDragging = ref(false)
const isWindowRightDragging = ref(false)
const didWindowRightDragMove = ref(false)
const suppressNextWindowContextMenu = ref(false)
const windowRightDragPointerId = ref(null)
const isLibraryOpen = ref(false)
const library = ref({ workspacePath: '', rootProjects: [], categories: [] })
const contextMenu = ref(null)
const isSettingsDialogOpen = ref(false)
const isProjectNameDialogOpen = ref(false)
const isUnsavedDialogOpen = ref(false)
const pendingProjectName = ref('未命名')
const projectNameDialogResolver = ref(null)
const unsavedDialogResolver = ref(null)
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
const isSavingProject = ref(false)
let projectOpenRequestId = 0
let savedProjectRevision = 0
let unsubscribeCloseRequest = null
const SETTINGS_STORAGE_KEY = 'mabelref.settings'
const SHOW_AI_FEATURES = false

const collapsedCategories = ref({})
const getProjectNameFromPath = (filePath) => {
  const fileName = String(filePath || '')
    .split(/[\\/]/)
    .pop()
  return fileName?.replace(/\.mabel$/i, '') || '未命名'
}

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

const markProjectClean = () => {
  canvasViewer.value?.markClean?.()
  savedProjectRevision = canvasViewer.value?.getRevision?.() ?? 0
}

const hasUnsavedChanges = () => {
  return (canvasViewer.value?.getRevision?.() ?? 0) !== savedProjectRevision
}

const openProjectNameDialog = (name = '未命名') =>
  new Promise((resolve) => {
    pendingProjectName.value = name
    isProjectNameDialogOpen.value = true
    projectNameDialogResolver.value = resolve

    nextTick(() => {
      document.querySelector('.project-name-dialog-input')?.focus()
      document.querySelector('.project-name-dialog-input')?.select()
    })
  })

const closeProjectNameDialog = (fileName = '') => {
  isProjectNameDialogOpen.value = false
  const resolve = projectNameDialogResolver.value
  projectNameDialogResolver.value = null
  resolve?.(fileName)
}

const submitProjectNameDialog = () => {
  const name = pendingProjectName.value.trim()
  if (!name) return
  closeProjectNameDialog(name)
}

const openUnsavedDialog = () =>
  new Promise((resolve) => {
    isUnsavedDialogOpen.value = true
    unsavedDialogResolver.value = resolve
  })

const closeUnsavedDialog = (action = 'cancel') => {
  isUnsavedDialogOpen.value = false
  const resolve = unsavedDialogResolver.value
  unsavedDialogResolver.value = null
  resolve?.(action)
}

const minimizeWindow = () => window.api.windowControls.minimize()
const toggleMaximizeWindow = async () => {
  isMaximized.value = await window.api.windowControls.toggleMaximize()
}
const closeWindow = () => window.api.windowControls.close()

const refreshLibrary = async () => {
  library.value = await window.api.library.get()
}

const setLibraryWorkspace = async () => {
  if (!(await confirmProjectChange())) return

  library.value = await window.api.library.setWorkspace()
  await createNewProject({ skipUnsavedCheck: true })
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
  if (isWindowRightDragging.value && event.pointerId === windowRightDragPointerId.value) {
    didWindowRightDragMove.value = true
  }

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

const endWindowRightDrag = () => {
  if (!isWindowRightDragging.value) return

  isWindowRightDragging.value = false
  didWindowRightDragMove.value = false
  windowRightDragPointerId.value = null
  window.api.windowControls.endCanvasDrag()
}

const handleShellPointerDown = async (event) => {
  if (event.button !== 2) return

  const shell = event.currentTarget
  const pointerId = event.pointerId
  const dragStarted = await window.api.windowControls.beginCanvasDrag()
  if (!dragStarted) return

  isWindowRightDragging.value = true
  didWindowRightDragMove.value = false
  windowRightDragPointerId.value = pointerId
  shell.setPointerCapture?.(pointerId)
}

const handleShellPointerUp = (event) => {
  if (event.button === 2 && didWindowRightDragMove.value) {
    suppressNextWindowContextMenu.value = true
    event.preventDefault()
    event.stopPropagation()
  }

  if (
    windowRightDragPointerId.value !== null &&
    event.currentTarget?.hasPointerCapture?.(windowRightDragPointerId.value)
  ) {
    event.currentTarget.releasePointerCapture(windowRightDragPointerId.value)
  }

  endWindowRightDrag()
}

const handleShellContextMenu = (event) => {
  if (!suppressNextWindowContextMenu.value) return

  suppressNextWindowContextMenu.value = false
  event.preventDefault()
  event.stopPropagation()
}

const handleWindowPointerUp = () => {
  isTopBarDragging.value = false
  endWindowRightDrag()
}

const handleImageLoaded = (count) => {
  imageCount.value = Math.max(0, imageCount.value + count)
}

const handleSelectedImageChange = (name) => {
  selectedImageName.value = name
}

const isLibraryProjectActive = (projectPath) => projectPath === (pendingProjectPath.value || activeProjectPath.value)

const showSelectedImageInFolder = async () => {
  await canvasViewer.value?.showSelectedInFolder()
}

const loadProjectIntoCanvas = async ({ filePath = '', name = '未命名', packagePath = '', project }, requestId) => {
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

  await canvasViewer.value.loadProject(project, { packagePath })
  if (requestId !== projectOpenRequestId) return

  pendingProjectPath.value = ''
  imageCount.value = project.nodes.length
  markProjectClean()
}

const confirmProjectChange = async () => {
  if (!hasUnsavedChanges()) return true

  const action = await openUnsavedDialog()

  if (action === 'cancel') return false
  if (action === 'discard') return true

  return saveProject()
}

const createNewProject = async ({ skipUnsavedCheck = false } = {}) => {
  if (!skipUnsavedCheck && !(await confirmProjectChange())) return

  const requestId = (projectOpenRequestId += 1)
  pendingProjectPath.value = ''
  await loadProjectIntoCanvas({
    filePath: '',
    name: '未命名',
    project: createEmptyMabelProject()
  }, requestId)
}

const openProject = async () => {
  if (!(await confirmProjectChange())) return

  const requestId = (projectOpenRequestId += 1)
  canvasViewer.value?.cancelProjectLoad()
  pendingProjectPath.value = ''
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
  if (filePath === (pendingProjectPath.value || activeProjectPath.value)) return
  if (!(await confirmProjectChange())) return

  const requestId = (projectOpenRequestId += 1)
  canvasViewer.value?.cancelProjectLoad()
  pendingProjectPath.value = filePath
  projectName.value = getProjectNameFromPath(filePath)
  selectedImageName.value = ''
  imageCount.value = 0
  projectError.value = ''

  let result
  try {
    result = await window.api.project.openPath(filePath)
    if (requestId !== projectOpenRequestId || result.canceled) return
  } catch (error) {
    if (requestId !== projectOpenRequestId) return
    pendingProjectPath.value = ''
    projectError.value = error.message || '项目打开失败'
    return
  }

  await loadProjectIntoCanvas(result, requestId)
  await refreshLibrary()
}

const saveProject = async ({ categoryId = '' } = {}) => {
  if (!canvasViewer.value || isSavingProject.value) return false

  isSavingProject.value = true
  try {
    let fileName = ''

    if (!activeProjectPath.value && !categoryId && library.value.workspacePath) {
      fileName = await openProjectNameDialog(projectName.value || '未命名')
      if (!fileName) return false
    }

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
        categoryId,
        fileName,
        requestId,
        project: canvasViewer.value.getProject()
      })
    } catch (error) {
      projectError.value = error.message || '项目保存失败'
      canvasViewer.value.markSaveCanceled()
      return false
    } finally {
      unsubscribe()
    }

    if (result.canceled) {
      canvasViewer.value.markSaveCanceled()
      return false
    }
    activeProjectPath.value = result.filePath
    projectName.value = result.name || projectName.value
    canvasViewer.value.markSaved()
    markProjectClean()
    await refreshLibrary()
    return true
  } finally {
    isSavingProject.value = false
  }
}

const handleCloseRequest = async () => {
  const allowClose = await confirmProjectChange()
  window.api.windowControls.finishClose(allowClose)
}

const toggleCanvasGrayscale = () => {
  isCanvasGrayscale.value = canvasViewer.value?.toggleAllImagesGrayscale() || false
}

const startCreateCategory = async () => {
  if (!library.value.workspacePath) {
    projectError.value = '请先设置工作空间，再新建分类'
    return
  }

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
  const result = await window.api.library.addProjectToCategory(category.id, {
    filePath: project.path,
    name: project.name
  })
  library.value = result.library

  if (project.path === activeProjectPath.value && result.project?.filePath) {
    activeProjectPath.value = result.project.filePath
    projectName.value = result.project.name || projectName.value
  }
}

const addNewCanvasToCategory = async (category) => {
  if (!(await confirmProjectChange())) return

  const requestId = (projectOpenRequestId += 1)
  await loadProjectIntoCanvas({
    filePath: '',
    name: '未命名',
    project: createEmptyMabelProject()
  }, requestId)

  await saveProject({ categoryId: category.id })
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
  if (type === 'library' && !library.value.workspacePath) {
    projectError.value = '请先设置工作空间，再新建分类'
    return
  }

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
  if (action === 'create-category') await startCreateCategory()
  if (action === 'add-new-canvas') await addNewCanvasToCategory(menu.payload.category)
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
  createNewProject({ skipUnsavedCheck: true })
  refreshLibrary()
  unsubscribeCloseRequest = window.api.windowControls.onCloseRequest(handleCloseRequest)
  window.addEventListener('pointerup', handleWindowPointerUp)
  window.addEventListener('click', closeLibraryContextMenu)
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  unsubscribeCloseRequest?.()
  unsubscribeCloseRequest = null
  window.removeEventListener('pointerup', handleWindowPointerUp)
  window.removeEventListener('click', closeLibraryContextMenu)
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <div
    class="window-shell"
    :class="{ 'canvas-focus-mode': isCanvasFocusMode }"
    @pointerdown.capture="handleShellPointerDown"
    @pointermove="handleShellPointerMove"
    @pointerup.capture="handleShellPointerUp"
    @pointercancel.capture="handleShellPointerUp"
    @contextmenu.capture="handleShellContextMenu"
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
        @contextmenu="openLibraryContextMenu($event, 'library')"
      >
        <div class="library-brand">
          <img :src="appLogo" alt="" class="library-brand-logo" />
          <div class="library-brand-copy">
            <strong>MabelRef</strong>
          </div>
        </div>

        <p v-if="projectError" class="library-error">{{ projectError }}</p>

        <button
          v-if="!library.workspacePath"
          type="button"
          class="library-workspace-button"
          @click="setLibraryWorkspace"
        >
          <FolderUp :size="14" :stroke-width="2" />
          <span>设置工作空间</span>
        </button>

        <section class="library-section">
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

          <div class="library-tree">
            <div
              v-for="project in library.rootProjects"
              :key="project.path"
              role="button"
              tabindex="0"
              class="library-project tree-project"
              :class="{ active: isLibraryProjectActive(project.path) }"
              :draggable="!isEditingLibraryProject(project)"
              :title="project.path"
              @click="!isEditingLibraryProject(project) && openProjectPath(project.path)"
              @keydown.enter.prevent="!isEditingLibraryProject(project) && openProjectPath(project.path)"
              @dragstart="handleRecentDragStart($event, project)"
              @contextmenu.stop="openLibraryContextMenu($event, 'project', { project })"
            >
              <span class="project-icon">
                <FileImage :size="14" :stroke-width="2" />
              </span>
              <input
                v-if="isEditingLibraryProject(project)"
                v-model="editingLibraryName"
                class="library-rename-input"
                type="text"
                @pointerdown.stop
                @mousedown.stop
                @click.stop
                @dragstart.stop
                @keydown.enter.stop.prevent="submitRenameLibraryItem"
                @keydown.esc.stop.prevent="cancelRenameLibraryItem"
                @blur="submitRenameLibraryItem"
              />
              <span v-else class="project-name">{{ project.name }}</span>
            </div>
          </div>

          <div
            v-for="category in library.categories"
            :key="category.id"
            class="library-category tree-category"
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
                @pointerdown.stop
                @mousedown.stop
                @click.stop
                @dragstart.stop
                @keydown.enter.stop.prevent="submitRenameLibraryItem"
                @keydown.esc.stop.prevent="cancelRenameLibraryItem"
                @blur="submitRenameLibraryItem"
              />
              <span v-else class="category-title">{{ category.name }}</span>
              <span class="category-count">{{ category.items?.length || 0 }}</span>
            </div>

            <div v-if="!collapsedCategories[category.id]" class="library-category-items tree-children">
              <div
                v-for="project in category.items"
                :key="`${category.id}:${project.path}`"
                role="button"
                tabindex="0"
                class="library-project nested tree-project tree-child"
                :class="{ active: isLibraryProjectActive(project.path) }"
                :draggable="!isEditingLibraryProject(project)"
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
                  @pointerdown.stop
                  @mousedown.stop
                  @click.stop
                  @dragstart.stop
                  @keydown.enter.stop.prevent="submitRenameLibraryItem"
                  @keydown.esc.stop.prevent="cancelRenameLibraryItem"
                  @blur="submitRenameLibraryItem"
                />
                <span v-else class="project-name">{{ project.name }}</span>
              </div>
            </div>
          </div>
          <p v-if="library.categories.length === 0 && library.rootProjects.length === 0" class="library-empty">
            {{ library.workspacePath ? '右键新建分类，或保存项目到工作空间' : '先设置工作空间' }}
          </p>
        </section>
      </aside>

      <CanvasViewer
        :key="canvasSessionId"
        ref="canvasViewer"
        :focus-mode="isCanvasFocusMode"
        :has-workspace="Boolean(library.workspacePath)"
        :shortcuts="shortcutSettings"
        @image-loaded="handleImageLoaded"
        @open-project-file="openProjectPath"
        @save-project="saveProject"
        @selected-image-change="handleSelectedImageChange"
        @set-workspace="setLibraryWorkspace"
      />
    </main>

    <div
      v-if="contextMenu"
      class="library-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button
        v-if="contextMenu.type === 'library'"
        type="button"
        @click="runContextAction('create-category')"
      >
        新建分类
      </button>
      <button
        v-if="contextMenu.type === 'category'"
        type="button"
        @click="runContextAction('add-new-canvas')"
      >
        添加新画布
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

    <div
      v-if="isProjectNameDialogOpen"
      class="project-name-backdrop"
      @click.self="closeProjectNameDialog('')"
    >
      <form class="project-name-dialog" @submit.prevent="submitProjectNameDialog">
        <header class="project-name-dialog-header">
          <h2>保存项目</h2>
          <button type="button" aria-label="关闭" title="关闭" @click="closeProjectNameDialog('')">
            <X :size="16" :stroke-width="2" />
          </button>
        </header>
        <label class="project-name-dialog-field">
          <span>文件名</span>
          <input
            v-model="pendingProjectName"
            class="project-name-dialog-input"
            type="text"
            placeholder="未命名"
            @keydown.esc.prevent="closeProjectNameDialog('')"
          />
        </label>
        <div class="project-name-dialog-actions">
          <button type="button" @click="closeProjectNameDialog('')">取消</button>
          <button type="submit" :disabled="!pendingProjectName.trim()">保存</button>
        </div>
      </form>
    </div>

    <div
      v-if="isUnsavedDialogOpen"
      class="unsaved-dialog-backdrop"
      @click.self="closeUnsavedDialog('cancel')"
    >
      <section class="unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
        <header class="unsaved-dialog-header">
          <div>
            <h2 id="unsaved-title">保存更改？</h2>
            <p>{{ projectName || '未命名' }}</p>
          </div>
          <button type="button" aria-label="关闭" title="关闭" @click="closeUnsavedDialog('cancel')">
            <X :size="16" :stroke-width="2" />
          </button>
        </header>
        <p class="unsaved-dialog-copy">当前画布有未保存的改动。离开前可以先保存，或直接放弃这些改动。</p>
        <div class="unsaved-dialog-actions">
          <button type="button" @click="closeUnsavedDialog('discard')">不保存</button>
          <button type="button" @click="closeUnsavedDialog('cancel')">取消</button>
          <button type="button" class="primary" @click="closeUnsavedDialog('save')">保存</button>
        </div>
      </section>
    </div>

    <div v-if="isSettingsDialogOpen" class="settings-backdrop" @click.self="closeSettingsDialog">
      <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <div>
            <h2 id="settings-title">设置</h2>
            <p>工作空间、快捷键与 AI 配置</p>
          </div>
          <button type="button" aria-label="关闭设置" title="关闭设置" @click="closeSettingsDialog">
            <X :size="16" :stroke-width="2" />
          </button>
        </header>

        <div class="settings-content">
          <section class="settings-section">
            <div class="settings-section-title">
              <h3>工作空间</h3>
              <button type="button" class="settings-text-button" @click="setLibraryWorkspace">
                {{ library.workspacePath ? '更改' : '设置' }}
              </button>
            </div>
            <div class="settings-workspace-path" :title="library.workspacePath || '未设置'">
              {{ library.workspacePath || '未设置' }}
            </div>
          </section>

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
