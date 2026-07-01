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
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileImage,
  Folder,
  Lightbulb,
  Briefcase,
  GraduationCap
} from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { createEmptyMabelProject } from '../../shared/mabelProject.mjs'
import CanvasViewer from './components/CanvasViewer.vue'

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
const isTopBarVisible = ref(false)
const isTopBarDragging = ref(false)
const isLibraryOpen = ref(false)
const library = ref({ recentProjects: [], categories: [] })
const contextMenu = ref(null)
const isCreatingCategory = ref(false)
const newCategoryName = ref('')
const newCategoryInput = ref(null)
let projectOpenRequestId = 0

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

const toggleWindowPin = async () => {
  isWindowPinned.value = await window.api.windowControls.togglePin()
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
  imageCount.value += count
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

const renameLibraryCategory = async (category) => {
  const name = window.prompt('重命名分类', category.name)
  if (!name?.trim()) return

  library.value = await window.api.library.renameCategory(category.id, name.trim())
}

const removeLibraryCategory = async (category) => {
  if (!window.confirm(`删除分类「${category.name}」？不会删除真实 Mabel 文件。`)) return

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

  if (action === 'rename-category') await renameLibraryCategory(menu.payload.category)
  if (action === 'remove-category') await removeLibraryCategory(menu.payload.category)
  if (action === 'add-current') await addCurrentProjectToCategory(menu.payload.category)
  if (action === 'show-project-folder') {
    await showLibraryProjectInFolder(menu.payload.project)
  }
  if (action === 'remove-project') {
    await removeProjectFromLibraryCategory(menu.payload.category, menu.payload.project)
  }
}

onMounted(() => {
  createNewProject()
  refreshLibrary()
  window.addEventListener('pointerup', handleWindowPointerUp)
  window.addEventListener('click', closeLibraryContextMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', handleWindowPointerUp)
  window.removeEventListener('click', closeLibraryContextMenu)
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
        <button type="button" aria-label="打开项目" title="打开项目" @click="openProject">
          <FolderOpen class="window-control-icon" />
        </button>
        <button type="button" aria-label="保存项目" title="保存项目" @click="saveProject">
          <Save class="window-control-icon" />
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
        <section class="library-section">
          <div class="library-section-header">
            <span>最近打开</span>
            <span class="section-count">{{ library.recentProjects.length }}</span>
          </div>
          <div class="library-section-items">
            <button
              v-for="project in library.recentProjects"
              :key="project.path"
              type="button"
              class="library-project"
              :class="{ active: project.path === activeProjectPath }"
              draggable="true"
              :title="project.path"
              @click="openProjectPath(project.path)"
              @dragstart="handleRecentDragStart($event, project)"
            >
              <span class="project-icon recent">
                <FileImage :size="14" :stroke-width="2" />
              </span>
              <span class="project-name">{{ project.name }}</span>
            </button>
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
              @click="toggleCategoryCollapse(category.id)"
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
              <span class="category-title">{{ category.name }}</span>
              <span class="category-count">{{ category.items?.length || 0 }}</span>
            </div>

            <!-- Nested items -->
            <div v-if="!collapsedCategories[category.id]" class="library-category-items">
              <button
                v-for="project in category.items"
                :key="`${category.id}:${project.path}`"
                type="button"
                class="library-project nested"
                :class="{ active: project.path === activeProjectPath }"
                draggable="true"
                :title="project.path"
                @click="openProjectPath(project.path)"
                @dragstart="handleRecentDragStart($event, project)"
                @contextmenu.stop="
                  openLibraryContextMenu($event, 'category-project', { category, project })
                "
              >
                <span class="project-icon" :style="{ '--project-accent': getCategoryStyle(category.name).color }">
                  <FileImage :size="14" :stroke-width="2" />
                </span>
                <span class="project-name">{{ project.name }}</span>
              </button>
            </div>
          </div>
          <p v-if="library.categories.length === 0" class="library-empty">右键或点加号新建分类</p>
        </section>
      </aside>

      <CanvasViewer
        :key="canvasSessionId"
        ref="canvasViewer"
        :focus-mode="isCanvasFocusMode"
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
        v-if="contextMenu.type === 'category-project'"
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

    <div v-if="isCanvasFocusMode" class="canvas-window-drag top" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag right" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag bottom" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag left" aria-hidden="true"></div>
  </div>
</template>
