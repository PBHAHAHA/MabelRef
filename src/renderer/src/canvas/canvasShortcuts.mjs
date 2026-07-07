/**
 * [INPUT]: 依赖 KeyboardEvent 形状的 key/ctrlKey/metaKey 字段
 * [OUTPUT]: 对外提供 canvas 快捷键动作识别函数
 * [POS]: renderer/canvas 的键盘快捷键纯函数，被 CanvasViewer.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function getCanvasShortcut(event) {
  if (!event.ctrlKey && !event.metaKey) {
    if (event.key === 'Delete' || event.key === 'Backspace') return 'delete'
    return null
  }

  const key = event.key.toLowerCase()
  if (event.key === 'ArrowUp') return 'layer-up'
  if (event.key === 'ArrowDown') return 'layer-down'
  if (key === 's') return 'save'
  if (key === 'r') return 'arrange'
  if (key === 'z') return 'undo'
  if (key === 'y') return 'redo'

  return null
}
