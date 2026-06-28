<script setup>
/**
 * [INPUT]: 依赖 Vue reactive 与 preload 暴露的 electron.process.versions
 * [OUTPUT]: 对外提供 Versions 运行时版本展示组件
 * [POS]: renderer/components 的环境信息组件，被 App.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { reactive } from 'vue'

const versions = reactive({ ...window.electron.process.versions })
</script>

<template>
  <ul class="versions">
    <li class="electron-version">Electron v{{ versions.electron }}</li>
    <li class="chrome-version">Chromium v{{ versions.chrome }}</li>
    <li class="node-version">Node v{{ versions.node }}</li>
  </ul>
</template>
