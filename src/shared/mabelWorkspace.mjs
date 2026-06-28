/**
 * [INPUT]: 依赖工作区根路径、分类目录和目录下文件列表
 * [OUTPUT]: 对外提供 Mabel 工作区 manifest、分类树归一化和路径归属判断能力
 * [POS]: shared 的工作区领域纯函数，被 main 扫描目录与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { basename, dirname, join, relative, resolve, sep } from 'path'

export const MABEL_WORKSPACE_MAGIC = 'MABEL_WORKSPACE'
export const MABEL_WORKSPACE_VERSION = 1
export const MABEL_WORKSPACE_FILE = '.mabel-workspace.json'

const MABEL_EXTENSION = '.mabel'

const isVisibleName = (name) => !name.startsWith('.')

const stripExtension = (name) =>
  name.toLowerCase().endsWith(MABEL_EXTENSION) ? name.slice(0, -MABEL_EXTENSION.length) : name

const ensureMabelExtension = (name) =>
  name.toLowerCase().endsWith(MABEL_EXTENSION) ? name : `${name}${MABEL_EXTENSION}`

export const sanitizeWorkspaceName = (name) =>
  name.trim().replace(/[\\/]/g, '-').replace(/^\.+$/, '')

export function createWorkspaceManifest({ name, createdAt = new Date().toISOString() }) {
  return {
    magic: MABEL_WORKSPACE_MAGIC,
    version: MABEL_WORKSPACE_VERSION,
    name: name?.trim() || 'Mabel Workspace',
    createdAt
  }
}

export function normalizeWorkspaceTree({ rootPath, entries }) {
  return {
    rootPath,
    name: basename(rootPath),
    categories: entries
      .filter((entry) => isVisibleName(entry.name))
      .map((entry) => {
        const projects = entry.files
          .filter((file) => isVisibleName(file.name))
          .filter((file) => file.name.toLowerCase().endsWith(MABEL_EXTENSION))
          .map((file) => ({
            id: file.path,
            name: stripExtension(file.name),
            path: file.path
          }))
          .sort((a, b) => a.name.localeCompare(b.name))

        return {
          id: entry.path,
          name: entry.name,
          path: entry.path,
          count: projects.length,
          projects
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}

export function isPathInside(parentPath, childPath) {
  const relativePath = relative(resolve(parentPath), resolve(childPath))

  return (
    relativePath === '' || (!relativePath.startsWith('..') && !relativePath.includes(`..${sep}`))
  )
}

export function createRenamedMabelPath(filePath, name) {
  const safeName = sanitizeWorkspaceName(name)
  if (!safeName) throw new Error('Project name is required')

  return join(dirname(filePath), ensureMabelExtension(safeName))
}
