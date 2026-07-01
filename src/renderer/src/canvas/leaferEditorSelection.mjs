/**
 * [INPUT]: Leafer Editor 实例
 * [OUTPUT]: 在手动改变视口后刷新编辑器选区框和编辑工具层
 * [POS]: renderer/canvas 的 Leafer Editor 选区同步工具，被 useLeaferImageEditor 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function syncEditorSelectionOverlay(editor) {
  editor?.updateEditBox?.()
  editor?.updateEditTool?.()
}
