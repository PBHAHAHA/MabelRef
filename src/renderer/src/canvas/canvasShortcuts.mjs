/**
 * [INPUT]: 依赖 KeyboardEvent 形状与用户快捷键配置
 * [OUTPUT]: 对外提供 canvas 快捷键动作识别函数
 * [POS]: renderer/canvas 的键盘快捷键纯函数，被 CanvasViewer.vue 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getShortcutAction } from '../shortcuts.mjs'

const CANVAS_SHORTCUTS = new Set([
  'arrange',
  'delete',
  'layer-down',
  'layer-up',
  'redo',
  'save',
  'undo'
])

export function getCanvasShortcut(event, shortcuts) {
  const action = getShortcutAction(event, shortcuts)

  return CANVAS_SHORTCUTS.has(action) ? action : null
}
