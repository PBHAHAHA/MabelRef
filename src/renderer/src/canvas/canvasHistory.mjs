/**
 * [INPUT]: 画布项目快照
 * [OUTPUT]: 提供简单的撤销历史栈，按后进先出返回深拷贝快照
 * [POS]: renderer/canvas 的历史管理纯工具，被 useLeaferImageEditor 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const DEFAULT_LIMIT = 80

const cloneSnapshot = (snapshot) => structuredClone(snapshot)

export function createCanvasHistory({ limit = DEFAULT_LIMIT } = {}) {
  const stack = []

  return {
    clear() {
      stack.length = 0
    },
    push(snapshot) {
      if (!snapshot) return
      stack.push(cloneSnapshot(snapshot))
      if (stack.length > limit) stack.shift()
    },
    undo() {
      const snapshot = stack.pop()
      return snapshot ? cloneSnapshot(snapshot) : null
    }
  }
}
