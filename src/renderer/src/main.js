/**
 * [INPUT]: 依赖 vue createApp、App.vue 与全局样式
 * [OUTPUT]: 挂载 Vue renderer 应用到 #app
 * [POS]: renderer 启动入口，连接 HTML 容器与根组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
