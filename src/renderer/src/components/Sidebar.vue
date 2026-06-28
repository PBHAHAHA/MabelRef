<script setup>
/**
 * [INPUT]: 依赖父组件传入的 categories、activeCategoryId 与图片数量
 * [OUTPUT]: 对外提供图片分类侧边栏与分类切换事件
 * [POS]: renderer/components 的导航组件，被 App.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
defineProps({
  categories: {
    type: Array,
    required: true
  },
  activeCategoryId: {
    type: String,
    required: true
  },
  imageCount: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['select-category'])
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <p>Library</p>
      <strong>{{ imageCount }}</strong>
    </div>

    <nav class="category-list" aria-label="图片分类">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        :class="{ active: category.id === activeCategoryId }"
        @click="emit('select-category', category.id)"
      >
        <span>{{ category.name }}</span>
        <small>{{ category.count }}</small>
      </button>
    </nav>
  </aside>
</template>
