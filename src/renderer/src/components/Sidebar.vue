<script setup>
/**
 * [INPUT]: 依赖 lucide-vue-next 图标与父组件传入的 library、activeCategoryPath、activeProjectPath 与图片数量
 * [OUTPUT]: 对外提供工作区分类侧边栏、图标式新建分类入口、分类右键菜单、项目打开、项目重命名和项目保存事件
 * [POS]: renderer/components 的导航组件，被 App.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { FileText, Folder, FolderPlus, Image } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  library: {
    type: Object,
    required: true
  },
  activeCategoryPath: {
    type: String,
    default: ''
  },
  activeProjectPath: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'create-category',
  'create-canvas',
  'open-project',
  'rename-project',
  'select-category'
])

const activeForm = ref('')
const categoryName = ref('')
const renameProjectName = ref('')
const categoryInput = ref(null)
const renameProjectInput = ref(null)
const renamingProjectPath = ref('')
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  categoryPath: ''
})

const focusInput = async (target) => {
  await nextTick()
  target.value?.focus()
  target.value?.select()
}

const showCategoryForm = () => {
  activeForm.value = activeForm.value === 'category' ? '' : 'category'
  if (activeForm.value === 'category') {
    categoryName.value = ''
    focusInput(categoryInput)
  }
}

const closeForm = () => {
  activeForm.value = ''
}

const closeRenameProject = () => {
  renamingProjectPath.value = ''
  renameProjectName.value = ''
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
}

const openContextMenu = (event, category) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    categoryPath: category.path
  }
  emit('select-category', category.path)
}

const createCanvasFromMenu = () => {
  emit('create-canvas', contextMenu.value.categoryPath)
  closeContextMenu()
}

const submitCategory = () => {
  const name = categoryName.value.trim()
  if (!name) return

  emit('create-category', name)
  categoryName.value = ''
  closeForm()
}

const startRenameProject = (project) => {
  renamingProjectPath.value = project.path
  renameProjectName.value = project.name
  focusInput(renameProjectInput)
}

const submitRenameProject = () => {
  const name = renameProjectName.value.trim()
  if (!name || !renamingProjectPath.value) return

  emit('rename-project', {
    filePath: renamingProjectPath.value,
    name
  })
  closeRenameProject()
}

const handleGlobalKeydown = (event) => {
  if (event.key === 'Escape') closeContextMenu()
}

onMounted(() => {
  window.addEventListener('click', closeContextMenu)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu)
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-tools" aria-label="工作区操作">
      <button type="button" aria-label="新增分类" title="新增分类" @click="showCategoryForm">
        <FolderPlus :size="15" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>

    <form
      v-if="activeForm === 'category'"
      class="library-inline-form"
      @submit.prevent="submitCategory"
      @keydown.esc.prevent="closeForm"
    >
      <label for="category-name">Category</label>
      <input
        id="category-name"
        ref="categoryInput"
        v-model="categoryName"
        type="text"
        placeholder="人物"
        autocomplete="off"
      />
      <div class="inline-form-actions">
        <button type="button" @click="closeForm">Cancel</button>
        <button type="submit" :disabled="!categoryName.trim()">Create</button>
      </div>
    </form>

    <p v-if="!activeCategoryPath && activeForm !== 'category'" class="library-hint">
      Create a category first.
    </p>

    <nav class="category-list" aria-label="项目分类">
      <section v-for="category in library.categories" :key="category.id" class="library-category">
        <button
          type="button"
          class="category-button"
          :class="{ active: category.path === activeCategoryPath }"
          @click="emit('select-category', category.path)"
          @contextmenu.prevent="openContextMenu($event, category)"
        >
          <span class="category-label">
            <Folder :size="13" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ category.name }}</span>
          </span>
          <small>{{ category.count }}</small>
        </button>

        <div v-if="category.path === activeCategoryPath" class="project-list">
          <template v-for="project in category.projects" :key="project.id">
            <form
              v-if="project.path === renamingProjectPath"
              class="project-rename-form"
              @submit.prevent="submitRenameProject"
              @keydown.esc.prevent="closeRenameProject"
            >
              <input
                ref="renameProjectInput"
                v-model="renameProjectName"
                type="text"
                autocomplete="off"
                @blur="closeRenameProject"
              />
            </form>
            <button
              v-else
              type="button"
              class="project-button"
              :class="{ active: project.path === activeProjectPath }"
              @click="emit('open-project', project.path)"
              @dblclick.stop="startRenameProject(project)"
            >
              <FileText :size="12" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ project.name }}</span>
            </button>
          </template>
          <p v-if="category.projects.length === 0">No projects</p>
        </div>
      </section>
    </nav>

    <div
      v-if="contextMenu.visible"
      class="library-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button type="button" @click="createCanvasFromMenu">
        <Image :size="13" :stroke-width="1.8" aria-hidden="true" />
        <span>新建画布</span>
      </button>
    </div>
  </aside>
</template>
