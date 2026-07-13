# components/

> L2 | 父级: /src/renderer/src/CLAUDE.md

成员清单
CanvasViewer.vue: Vue WebGPU 画布容器，提供拖拽导入引导，接收批量拖入图片/文件夹与按鼠标位置粘贴图片，导入/打开项目期间弹模态进度框并阻断画布交互（指针/键盘/滚轮/拖放），支持专注模式隐藏工具条，提供选中图片快捷排版，展示并定位选中图片原始路径，并委托 engine/useEngineImageEditor 管理节点、排版、缩放和项目快照
Versions.vue: Vue 运行时版本组件，从 preload 暴露的 electron.process.versions 读取 Electron/Chromium/Node 版本

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
