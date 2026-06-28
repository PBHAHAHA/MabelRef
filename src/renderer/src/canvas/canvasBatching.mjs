/**
 * [INPUT]: 依赖普通数组与批次大小
 * [OUTPUT]: 对外提供 chunkItems/getLoadBatchSize，将画布节点拆成稳定小批次
 * [POS]: renderer/canvas 的批处理工具，被 useLeaferImageEditor 加载项目时消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function chunkItems(items, batchSize) {
  const size = Math.max(1, batchSize)
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export function getLoadBatchSize(totalItems) {
  if (totalItems >= 100) return 4
  if (totalItems >= 24) return 6

  return 12
}
