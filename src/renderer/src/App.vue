<script setup>
/**
 * [INPUT]: 依赖 Sidebar/CanvasViewer 组件与 preload 暴露的 windowControls API
 * [OUTPUT]: 对外提供图片查看器根组件、两栏布局和 Windows 风格窗口控制栏
 * [POS]: renderer 根组件，组织窗口壳、分类导航与 canvas 查看区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ref } from 'vue'
import CanvasViewer from './components/CanvasViewer.vue'
import Sidebar from './components/Sidebar.vue'

const isMaximized = ref(false)
const activeCategoryId = ref('all')
const imageCount = ref(0)
const categories = ref([
  { id: 'all', name: '全部图片', count: 0 },
  { id: 'recent', name: '最近导入', count: 0 },
  { id: 'favorite', name: '收藏', count: 0 }
])

const minimizeWindow = () => window.api.windowControls.minimize()
const toggleMaximizeWindow = async () => {
  isMaximized.value = await window.api.windowControls.toggleMaximize()
}
const closeWindow = () => window.api.windowControls.close()

const selectCategory = (categoryId) => {
  activeCategoryId.value = categoryId
}

const handleImageLoaded = (count) => {
  imageCount.value += count
  categories.value = categories.value.map((category) => {
    if (category.id === 'favorite') return category
    return { ...category, count: category.count + count }
  })
}

const handleProjectLoaded = (count) => {
  imageCount.value = count
  categories.value = categories.value.map((category) => {
    if (category.id === 'favorite') return { ...category, count: 0 }
    return { ...category, count }
  })
}
</script>

<template>
  <div class="window-shell">
    <header class="titlebar">
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

    <main class="image-viewer-layout">
      <Sidebar
        :categories="categories"
        :active-category-id="activeCategoryId"
        :image-count="imageCount"
        @select-category="selectCategory"
      />
      <CanvasViewer @image-loaded="handleImageLoaded" @project-loaded="handleProjectLoaded" />
    </main>
  </div>
</template>
