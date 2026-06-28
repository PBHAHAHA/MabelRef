# components/

> L2 | 父级: /src/renderer/src/CLAUDE.md

成员清单
CanvasViewer.vue: Vue Leafer Editor 容器，接收批量拖入图片与按鼠标位置粘贴图片，支持专注模式隐藏工具条，提供选中图片快捷排版，展示并定位选中图片原始路径，并委托 canvas/useLeaferImageEditor 管理节点、排版、缩放和项目快照
Sidebar.vue: Vue 工作区侧栏，使用 lucide-vue-next 图标展示分类文件夹、分类下 .mabel 项目、图标式新建分类入口、项目双击重命名和分类右键新建画布菜单
Versions.vue: Vue 运行时版本组件，从 preload 暴露的 electron.process.versions 读取 Electron/Chromium/Node 版本
WorkspaceGate.vue: Vue 工作区入口组件，在未选择工作区时提供打开/创建工作区动作

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
