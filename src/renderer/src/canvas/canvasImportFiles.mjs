/**
 * [INPUT]: 拖拽或文件选择得到的 File 列表，以及 Electron preload 暴露的文件路径读取函数
 * [OUTPUT]: 区分画布图片导入文件与 .mabel 项目文件路径
 * [POS]: renderer/canvas 的文件导入分类工具，被 CanvasViewer 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function isMabelProjectFile(file) {
  return file?.name?.toLowerCase().endsWith('.mabel') || false
}

export function isImageFile(file) {
  if (file?.type?.startsWith('image/')) return true
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file?.name || '')
}

export function getImageFiles(files) {
  return files.filter((file) => isImageFile(file) && !isMabelProjectFile(file))
}

export function getDroppedMabelProjectPath(files, getPath) {
  const projectFile = files.find(isMabelProjectFile)
  if (!projectFile) return ''

  try {
    return getPath(projectFile)
  } catch {
    return ''
  }
}
