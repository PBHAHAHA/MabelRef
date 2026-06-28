/**
 * [INPUT]: 依赖 Leafer tree 的 children 节点集合
 * [OUTPUT]: 对外提供 destroyTreeChildren，用快照遍历销毁全部画布节点
 * [POS]: renderer/canvas 的 Leafer 生命周期工具，被 useLeaferImageEditor 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function destroyTreeChildren(tree) {
  for (const child of [...(tree?.children || [])]) {
    child.destroy()
  }
}
