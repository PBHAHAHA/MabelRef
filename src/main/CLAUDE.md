# main/

> L2 | 父级: /src/CLAUDE.md

成员清单
index.js: Electron 主进程入口，使用 BrowserWindow frame:false 隐藏系统标题栏，移除原生菜单，ipcMain 暴露窗口控制、画布专注模式、工作区选择/创建/扫描、工作区内空画布创建、项目重命名、文件定位与工作区内 .mabel 项目保存/打开
windowFocusMode.mjs: 窗口层级工具，封装画布专注模式的 alwaysOnTop 与跨工作区可见设置

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
