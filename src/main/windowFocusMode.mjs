/**
 * [INPUT]: 依赖 Electron BrowserWindow 的 setAlwaysOnTop 与 setVisibleOnAllWorkspaces 能力
 * [OUTPUT]: 对外提供 applyCanvasFocusMode，用于切换画布专注模式的窗口层级
 * [POS]: main 的窗口模式工具，被 index.js 的 windowControls IPC 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function applyCanvasFocusMode(window, enabled) {
  window.setAlwaysOnTop(enabled, enabled ? 'screen-saver' : 'normal')
  window.setVisibleOnAllWorkspaces(enabled)
}
