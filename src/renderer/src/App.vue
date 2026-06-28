<script setup>
/**
 * [INPUT]: 依赖 Sidebar/CanvasViewer/WorkspaceGate 组件与 preload 暴露的 windowControls/workspace/library API
 * [OUTPUT]: 对外提供图片查看器根组件、画布专注模式、工作区选择、工作区 .mabel 项目库、选中文件后显示 canvas、分类右键新建画布、两栏布局和 Windows 风格窗口控制栏
 * [POS]: renderer 根组件，组织窗口壳、工作区入口、分类导航与 canvas 查看区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { nextTick, onMounted, ref } from 'vue'
import CanvasViewer from './components/CanvasViewer.vue'
import Sidebar from './components/Sidebar.vue'
import WorkspaceGate from './components/WorkspaceGate.vue'

const isMaximized = ref(false)
const canvasViewer = ref(null)
const canvasSessionId = ref(0)
const activeCategoryPath = ref('')
const activeProjectPath = ref('')
const imageCount = ref(0)
const library = ref(null)
const workspaceLoading = ref(true)
const workspaceError = ref('')
const projectError = ref('')
const isCanvasFocusMode = ref(false)
let projectOpenRequestId = 0

const minimizeWindow = () => window.api.windowControls.minimize()
const toggleMaximizeWindow = async () => {
  isMaximized.value = await window.api.windowControls.toggleMaximize()
}
const closeWindow = () => window.api.windowControls.close()

const setCanvasFocusMode = async (enabled) => {
  isCanvasFocusMode.value = await window.api.windowControls.setCanvasFocusMode(enabled)
}

const applyWorkspace = (workspace) => {
  library.value = workspace

  if (!workspace) {
    activeCategoryPath.value = ''
    activeProjectPath.value = ''
    imageCount.value = 0
    return
  }

  if (!activeCategoryPath.value && workspace.categories.length > 0) {
    activeCategoryPath.value = workspace.categories[0].path
  }
}

const loadCurrentWorkspace = async () => {
  workspaceLoading.value = true
  workspaceError.value = ''

  try {
    const result = await window.api.workspace.getCurrent()
    applyWorkspace(result.workspace)
  } catch (error) {
    workspaceError.value = error.message || '工作区加载失败'
  } finally {
    workspaceLoading.value = false
  }
}

const chooseWorkspace = async () => {
  workspaceError.value = ''
  const result = await window.api.workspace.choose()
  if (result.canceled) return

  activeCategoryPath.value = ''
  activeProjectPath.value = ''
  imageCount.value = 0
  applyWorkspace(result.workspace)
}

const createWorkspace = async () => {
  workspaceError.value = ''
  const result = await window.api.workspace.create()
  if (result.canceled) return

  activeCategoryPath.value = ''
  activeProjectPath.value = ''
  imageCount.value = 0
  applyWorkspace(result.workspace)
}

const selectCategory = (categoryPath) => {
  activeCategoryPath.value = categoryPath
}

const handleImageLoaded = (count) => {
  imageCount.value += count
}

const createCategory = async (name) => {
  if (!name) return

  library.value = await window.api.library.createCategory(name)
  const created = library.value.categories.find((category) => category.name === name.trim())
  if (created) activeCategoryPath.value = created.path
}

const openLibraryProject = async (filePath) => {
  const requestId = (projectOpenRequestId += 1)
  projectError.value = ''

  let result
  try {
    result = await window.api.library.openProject(filePath)
    if (requestId !== projectOpenRequestId) return
  } catch (error) {
    if (requestId !== projectOpenRequestId) return
    projectError.value = error.message || '项目打开失败'
    activeProjectPath.value = ''
    imageCount.value = 0
    return
  }

  activeProjectPath.value = ''
  await nextTick()
  if (requestId !== projectOpenRequestId) return

  activeProjectPath.value = result.filePath
  canvasSessionId.value += 1
  await nextTick()
  if (requestId !== projectOpenRequestId) return

  await canvasViewer.value.loadProject(result.project)
  imageCount.value = result.project.nodes.length
}

const renameLibraryProject = async ({ filePath, name }) => {
  if (!filePath || !name) return

  const result = await window.api.library.renameProject({ filePath, name })
  library.value = result.library
  if (activeProjectPath.value === filePath) activeProjectPath.value = result.filePath
}

const createCanvasInCategory = async (categoryPath) => {
  if (!categoryPath) return

  const requestId = (projectOpenRequestId += 1)
  const result = await window.api.library.createCanvas({
    categoryPath,
    projectName: 'Untitled'
  })
  if (requestId !== projectOpenRequestId) return

  library.value = result.library
  activeCategoryPath.value = categoryPath
  activeProjectPath.value = ''
  await nextTick()
  if (requestId !== projectOpenRequestId) return

  activeProjectPath.value = result.filePath
  canvasSessionId.value += 1
  await nextTick()
  if (requestId !== projectOpenRequestId) return

  await canvasViewer.value.loadProject(result.project)
  imageCount.value = 0
}

const saveProjectToCategory = async (projectName) => {
  const targetProjectName = projectName || 'Untitled'
  if (!activeProjectPath.value && !activeCategoryPath.value) return

  const result = await window.api.library.saveProject({
    filePath: activeProjectPath.value,
    categoryPath: activeCategoryPath.value,
    projectName: targetProjectName,
    project: canvasViewer.value.getProject()
  })

  library.value = result.library
  activeProjectPath.value = result.filePath
  canvasViewer.value.markSaved()
}

onMounted(() => {
  loadCurrentWorkspace()
})
</script>

<template>
  <div class="window-shell" :class="{ 'canvas-focus-mode': isCanvasFocusMode }">
    <header v-if="!isCanvasFocusMode" class="titlebar">
      <div class="titlebar-brand">
        <span class="app-mark" aria-hidden="true"></span>
        <span>Mabel Boxs</span>
      </div>

      <nav class="window-controls" aria-label="窗口控制">
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

    <WorkspaceGate
      v-if="!library"
      :loading="workspaceLoading"
      :error="workspaceError"
      @choose-workspace="chooseWorkspace"
      @create-workspace="createWorkspace"
    />

    <main v-else class="image-viewer-layout">
      <Sidebar
        v-if="!isCanvasFocusMode"
        :library="library"
        :active-category-path="activeCategoryPath"
        :active-project-path="activeProjectPath"
        @create-category="createCategory"
        @create-canvas="createCanvasInCategory"
        @open-project="openLibraryProject"
        @rename-project="renameLibraryProject"
        @select-category="selectCategory"
      />
      <CanvasViewer
        v-if="activeProjectPath"
        :key="canvasSessionId"
        ref="canvasViewer"
        :focus-mode="isCanvasFocusMode"
        @image-loaded="handleImageLoaded"
        @save-project="saveProjectToCategory"
      />
      <section v-else class="empty-canvas-state">
        <div>
          <p>{{ projectError || 'Select a .mabel file' }}</p>
          <span>{{ projectError ? '请选择其他项目，或从备份恢复这个文件。' : 'Right-click a category to create a canvas.' }}</span>
        </div>
      </section>
    </main>

    <button
      v-if="activeProjectPath && !isCanvasFocusMode"
      type="button"
      class="canvas-focus-enter"
      aria-label="只显示画布"
      title="只显示画布"
      @click="setCanvasFocusMode(true)"
    >
      <span aria-hidden="true"></span>
    </button>

    <button
      v-if="isCanvasFocusMode"
      type="button"
      class="canvas-focus-exit"
      aria-label="恢复界面"
      title="恢复界面"
      @click="setCanvasFocusMode(false)"
    >
      恢复
    </button>

    <div v-if="isCanvasFocusMode" class="canvas-window-drag top" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag right" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag bottom" aria-hidden="true"></div>
    <div v-if="isCanvasFocusMode" class="canvas-window-drag left" aria-hidden="true"></div>
  </div>
</template>
