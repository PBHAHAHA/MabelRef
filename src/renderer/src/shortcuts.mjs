/**
 * [INPUT]: 依赖 KeyboardEvent 形状对象与用户保存的快捷键配置
 * [OUTPUT]: 提供默认快捷键、快捷键格式化、事件序列化和动作匹配能力
 * [POS]: renderer 快捷键共享工具，被 App.vue 与 CanvasViewer.vue 共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const DEFAULT_SHORTCUTS = {
  arrange: 'Ctrl+R',
  delete: ['Delete', 'Backspace'],
  'layer-down': 'Ctrl+ArrowDown',
  'layer-up': 'Ctrl+ArrowUp',
  redo: 'Ctrl+Y',
  save: 'Ctrl+S',
  sidebar: 'Ctrl+B',
  undo: 'Ctrl+Z'
}

export const SHORTCUT_LABELS = {
  arrange: '排版选中图片',
  delete: '删除选中图片',
  'layer-down': '图片下移一层',
  'layer-up': '图片上移一层',
  redo: '重做',
  save: '保存项目',
  sidebar: '打开/收起侧边栏',
  undo: '撤回'
}

export const SHORTCUT_ACTIONS = [
  'sidebar',
  'save',
  'undo',
  'redo',
  'layer-up',
  'layer-down',
  'arrange',
  'delete'
]

const KEY_ALIASES = {
  ' ': 'Space',
  Esc: 'Escape',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight'
}

const DISPLAY_KEYS = {
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Esc',
  Space: 'Space'
}

export const normalizeShortcutKey = (key) => {
  const normalized = KEY_ALIASES[key] || key

  if (normalized.length === 1) return normalized.toUpperCase()
  return normalized
}

export const normalizeShortcut = (shortcut) => {
  if (Array.isArray(shortcut)) {
    return shortcut.map((item) => normalizeShortcut(item)).filter(Boolean)
  }

  const parts = String(shortcut || '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const modifiers = new Set()
  let key = ''

  parts.forEach((part) => {
    const normalizedPart = part.toLowerCase()
    if (normalizedPart === 'ctrl' || normalizedPart === 'control' || normalizedPart === 'cmd') {
      modifiers.add('Ctrl')
      return
    }
    if (normalizedPart === 'meta') {
      modifiers.add('Ctrl')
      return
    }
    if (normalizedPart === 'alt' || normalizedPart === 'option') {
      modifiers.add('Alt')
      return
    }
    if (normalizedPart === 'shift') {
      modifiers.add('Shift')
      return
    }
    key = normalizeShortcutKey(part)
  })

  if (!key) return ''

  return [...modifiers].sort().concat(key).join('+')
}

export const getShortcutSettings = (shortcuts = {}) => ({
  ...DEFAULT_SHORTCUTS,
  ...Object.fromEntries(
    Object.entries(shortcuts || {})
      .map(([action, shortcut]) => [action, normalizeShortcut(shortcut)])
      .filter(([, shortcut]) => (Array.isArray(shortcut) ? shortcut.length > 0 : shortcut))
  )
})

export const getEventShortcut = (event) => {
  const parts = []

  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')

  const key = normalizeShortcutKey(event.key)
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return ''

  parts.push(key)
  return parts.join('+')
}

export const getShortcutAction = (event, shortcuts = {}) => {
  const eventShortcut = getEventShortcut(event)
  if (!eventShortcut) return null

  const settings = getShortcutSettings(shortcuts)
  return (
    SHORTCUT_ACTIONS.find((action) => {
      const shortcut = settings[action]
      return Array.isArray(shortcut) ? shortcut.includes(eventShortcut) : shortcut === eventShortcut
    }) || null
  )
}

export const formatShortcut = (shortcut) => {
  if (Array.isArray(shortcut)) return shortcut.map((item) => formatShortcut(item)).join(' / ')

  const normalized = normalizeShortcut(shortcut)
  if (!normalized) return ''

  return normalized
    .split('+')
    .map((part) => DISPLAY_KEYS[part] || part)
    .join(' + ')
}
