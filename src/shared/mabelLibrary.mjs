/**
 * [INPUT]: 接收本地 .mabel 资料库状态、项目路径和分类名称
 * [OUTPUT]: 提供最近打开、分类创建与分类路径引用的纯函数
 * [POS]: shared 资料库模型模块，被主进程 IPC 与测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { basename } from 'path'

export const MAX_RECENT_PROJECTS = 30

const now = () => Date.now()

const getProjectName = (filePath, fallback = '未命名') => {
  if (!filePath) return fallback

  const name = basename(filePath)
  return name.toLowerCase().endsWith('.mabel') ? name.slice(0, -6) : name
}

const normalizeProjectItem = (item) => ({
  path: String(item?.path || ''),
  name: String(item?.name || getProjectName(item?.path || '')),
  lastOpenedAt: Number(item?.lastOpenedAt || 0)
})

const createCategoryId = () => `cat-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function createEmptyLibrary() {
  return {
    version: 1,
    recentProjects: [],
    categories: []
  }
}

export function normalizeLibrary(library) {
  const source = library && typeof library === 'object' ? library : {}
  const recentProjects = Array.isArray(source.recentProjects) ? source.recentProjects : []
  const categories = Array.isArray(source.categories) ? source.categories : []

  return {
    version: 1,
    recentProjects: recentProjects
      .map(normalizeProjectItem)
      .filter((item) => item.path)
      .slice(0, MAX_RECENT_PROJECTS),
    categories: categories
      .map((category) => ({
        id: String(category?.id || createCategoryId()),
        name: String(category?.name || '未命名分类'),
        items: (Array.isArray(category?.items) ? category.items : [])
          .map(normalizeProjectItem)
          .filter((item) => item.path)
      }))
      .filter((category) => category.name.trim())
  }
}

export function touchRecentProject(library, filePath, name = getProjectName(filePath)) {
  const normalized = normalizeLibrary(library)
  if (!filePath) return normalized

  const item = {
    path: filePath,
    name: name || getProjectName(filePath),
    lastOpenedAt: now()
  }

  normalized.recentProjects = [
    item,
    ...normalized.recentProjects.filter((project) => project.path !== filePath)
  ].slice(0, MAX_RECENT_PROJECTS)

  return normalized
}

export function addCategory(library, name) {
  const normalized = normalizeLibrary(library)
  const trimmed = String(name || '').trim()
  if (!trimmed) return normalized

  normalized.categories = [
    ...normalized.categories,
    {
      id: createCategoryId(),
      name: trimmed,
      items: []
    }
  ]

  return normalized
}

export function renameCategory(library, categoryId, name) {
  const normalized = normalizeLibrary(library)
  const trimmed = String(name || '').trim()
  if (!trimmed) return normalized

  normalized.categories = normalized.categories.map((category) =>
    category.id === categoryId ? { ...category, name: trimmed } : category
  )

  return normalized
}

export function removeCategory(library, categoryId) {
  const normalized = normalizeLibrary(library)
  normalized.categories = normalized.categories.filter((category) => category.id !== categoryId)
  return normalized
}

export function addProjectToCategory(
  library,
  categoryId,
  filePath,
  name = getProjectName(filePath)
) {
  const normalized = normalizeLibrary(library)
  if (!filePath) return normalized

  normalized.categories = normalized.categories.map((category) => {
    if (category.id !== categoryId) return category

    const item = {
      path: filePath,
      name: name || getProjectName(filePath),
      lastOpenedAt: now()
    }

    return {
      ...category,
      items: [item, ...category.items.filter((project) => project.path !== filePath)]
    }
  })

  return normalized
}

export function removeProjectFromCategory(library, categoryId, filePath) {
  const normalized = normalizeLibrary(library)
  normalized.categories = normalized.categories.map((category) =>
    category.id === categoryId
      ? { ...category, items: category.items.filter((project) => project.path !== filePath) }
      : category
  )

  return normalized
}
