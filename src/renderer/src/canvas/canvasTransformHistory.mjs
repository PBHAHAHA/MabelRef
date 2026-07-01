/**
 * [INPUT]: Leafer 编辑器变形事件与记录快照函数
 * [OUTPUT]: 对连续变形做一次事务只记录一份历史，直到交互结束后才允许再次记录
 * [POS]: renderer/canvas 的变形历史节流工具，被 useLeaferImageEditor 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function createTransformHistoryRecorder(remember) {
  let hasActiveTransform = false

  return {
    remember() {
      if (hasActiveTransform) return

      hasActiveTransform = true
      remember()
    },
    reset() {
      hasActiveTransform = false
    }
  }
}
