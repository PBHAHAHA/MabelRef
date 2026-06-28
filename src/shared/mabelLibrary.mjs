/**
 * [INPUT]: 依赖本地库根路径、分类目录和目录下文件列表
 * [OUTPUT]: 对外提供 .mabel 项目库树结构归一化能力
 * [POS]: shared 的项目库纯函数，被 main 扫描目录后调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { normalizeWorkspaceTree } from './mabelWorkspace.mjs'

export function createLibraryTree({ rootPath, entries }) {
  return normalizeWorkspaceTree({ rootPath, entries })
}
