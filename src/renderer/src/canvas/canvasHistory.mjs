/**
 * [INPUT]: 画布项目快照
 * [OUTPUT]: 提供简单的撤销历史栈，按后进先出返回深拷贝快照
 * [POS]: renderer/canvas 的历史管理纯工具，被 engine/useEngineImageEditor 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const DEFAULT_LIMIT = 80

const cloneSnapshot = (snapshot) => structuredClone(snapshot)

export function createCanvasHistory({ limit = DEFAULT_LIMIT } = {}) {
  const undoStack = []
  const redoStack = []

  const pushBounded = (stack, snapshot) => {
    stack.push(cloneSnapshot(snapshot))
    if (stack.length > limit) stack.shift()
  }

  return {
    clear() {
      undoStack.length = 0
      redoStack.length = 0
    },
    push(snapshot) {
      if (!snapshot) return
      pushBounded(undoStack, snapshot)
      redoStack.length = 0
    },
    undo(currentSnapshot) {
      const snapshot = undoStack.pop()
      if (snapshot && currentSnapshot) pushBounded(redoStack, currentSnapshot)
      return snapshot ? cloneSnapshot(snapshot) : null
    },
    redo(currentSnapshot) {
      const snapshot = redoStack.pop()
      if (snapshot && currentSnapshot) pushBounded(undoStack, currentSnapshot)
      return snapshot ? cloneSnapshot(snapshot) : null
    }
  }
}
