/**
 * [INPUT]: 依赖 DataTransferItem 的 webkitGetAsEntry 与 FileSystemDirectoryReader 递归读取能力
 * [OUTPUT]: 对外提供 collectDroppedFiles 函数，将拖拽文件夹和文件统一展开为 File 列表
 * [POS]: renderer/canvas 的拖拽目录展开工具，被 CanvasViewer 在导入前消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const readEntryFile = (entry) =>
  new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })

const readDirectoryEntries = (reader) =>
  new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject)
  })

async function collectEntryFiles(entry) {
  if (!entry) return []
  if (entry.isFile) return [await readEntryFile(entry)]
  if (!entry.isDirectory) return []

  const reader = entry.createReader()
  const files = []

  while (true) {
    const entries = await readDirectoryEntries(reader)
    if (entries.length === 0) break

    for (const childEntry of entries) {
      files.push(...(await collectEntryFiles(childEntry)))
    }
  }

  return files
}

const getFileKey = (file) => {
  const filePath = globalThis.window?.api?.files?.getPath?.(file)
  return filePath || `${file.name}:${file.size}:${file.lastModified}`
}

const dedupeFiles = (files) => {
  const seen = new Set()

  return files.filter((file) => {
    const key = getFileKey(file)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function collectDroppedFiles(dataTransfer) {
  const directFiles = [...(dataTransfer?.files || [])]
  const items = [...(dataTransfer?.items || [])]
  if (items.length === 0) return directFiles

  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean)
  const directoryEntries = entries.filter((entry) => entry.isDirectory)

  if (directoryEntries.length === 0 && directFiles.length > 0) {
    return dedupeFiles(directFiles)
  }

  const files = [...directFiles]

  for (const entry of directoryEntries) {
    files.push(...(await collectEntryFiles(entry)))
  }

  if (files.length === 0) {
    for (const item of items) {
      const file = item.getAsFile?.()
      if (file) files.push(file)
    }
  }

  return dedupeFiles(files)
}
