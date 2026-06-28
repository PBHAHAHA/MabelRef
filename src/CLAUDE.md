# src/
> L2 | 父级: /CLAUDE.md

成员清单
main/: Electron 主进程，创建无边框窗口、隐藏原生菜单、注册窗口控制 IPC
preload/: 安全桥，暴露 electron-toolkit 能力与最小窗口控制 API
renderer/: Vue 渲染层，绘制灰黑应用壳、Windows 风格标题栏与页面内容
shared/: main/renderer 共用纯函数，包含 .mabel 项目格式编码解码

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
