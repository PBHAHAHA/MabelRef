# components/
> L2 | 父级: /src/renderer/src/CLAUDE.md

成员清单
CanvasViewer.vue: Vue Leafer Editor 容器，接收批量拖入图片与按鼠标位置粘贴图片，提供选中图片快捷排版，展示并定位选中图片原始路径，提供 .mabel 保存/打开按钮，并委托 canvas/useLeaferImageEditor 管理节点、排版和缩放
Sidebar.vue: Vue 分类侧栏，展示图片分类、数量和当前分类选择
Versions.vue: Vue 运行时版本组件，从 preload 暴露的 electron.process.versions 读取 Electron/Chromium/Node 版本

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
