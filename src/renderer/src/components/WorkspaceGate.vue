<script setup>
/**
 * [INPUT]: 依赖父组件传入的 loading/error 状态
 * [OUTPUT]: 对外提供启动工作区选择界面与 open/create 事件
 * [POS]: renderer/components 的工作区入口组件，被 App.vue 在未选择工作区时消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
defineProps({
  loading: {
    type: Boolean,
    required: true
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['choose-workspace', 'create-workspace'])
</script>

<template>
  <main class="workspace-gate">
    <section class="workspace-panel" aria-label="选择工作区">
      <div class="workspace-panel-copy">
        <p>Mabel Workspace</p>
        <h1>选择一个工作区开始</h1>
        <span>分类是文件夹，画布是 .mabel 文件。</span>
      </div>

      <div class="workspace-panel-actions">
        <button type="button" :disabled="loading" @click="emit('choose-workspace')">
          打开工作区
        </button>
        <button type="button" :disabled="loading" @click="emit('create-workspace')">
          创建工作区
        </button>
      </div>

      <p v-if="error" class="workspace-error">{{ error }}</p>
    </section>
  </main>
</template>
