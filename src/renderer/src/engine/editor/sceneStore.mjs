/**
 * [INPUT]: 依赖普通节点记录（id/textureId/几何/透明度/灰度），无框架依赖
 * [OUTPUT]: 对外提供 createSceneStore——文档单一真相源，节点增删改、选中集与订阅通知，所有变更走不可变替换
 * [POS]: engine/editor 的状态核心，渲染(setNodes)与覆盖层(draw)都是它的投影，node 可测
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export function createSceneStore() {
  let nodes = []
  let selectedIds = new Set()
  const listeners = new Set()

  const emit = () => listeners.forEach((listener) => listener())

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    getNodes: () => nodes,
    getNode: (id) => nodes.find((node) => node.id === id) || null,
    getSelectedIds: () => [...selectedIds],
    getSelectedNodes: () => nodes.filter((node) => selectedIds.has(node.id)),
    isSelected: (id) => selectedIds.has(id),

    setNodes(nextNodes) {
      nodes = [...nextNodes]
      selectedIds = new Set([...selectedIds].filter((id) => nodes.some((node) => node.id === id)))
      emit()
    },

    addNodes(newNodes) {
      nodes = [...nodes, ...newNodes]
      emit()
    },

    applyPatches(patches) {
      if (patches.size === 0) return

      nodes = nodes.map((node) =>
        patches.has(node.id) ? { ...node, ...patches.get(node.id) } : node
      )
      emit()
    },

    setSelection(ids) {
      selectedIds = new Set(ids)
      emit()
    },

    toggleSelection(id) {
      const next = new Set(selectedIds)

      if (next.has(id)) next.delete(id)
      else next.add(id)
      selectedIds = next
      emit()
    },

    removeSelected() {
      if (selectedIds.size === 0) return 0

      const removedCount = selectedIds.size

      nodes = nodes.filter((node) => !selectedIds.has(node.id))
      selectedIds = new Set()
      emit()
      return removedCount
    }
  }
}
