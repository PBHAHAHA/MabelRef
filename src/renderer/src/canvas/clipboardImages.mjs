/**
 * [INPUT]: 依赖浏览器 ClipboardEvent.clipboardData 的 files/items
 * [OUTPUT]: 对外提供从剪贴板提取图片 File 列表的纯函数
 * [POS]: renderer/canvas 的剪贴板图片入口，被 CanvasViewer 粘贴事件调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const getExtension = (mime) => {
  const subtype = mime.split('/').at(1) || 'png'
  return subtype === 'jpeg' ? 'jpg' : subtype
}

export function getClipboardImageFiles(clipboardData) {
  const files = Array.from(clipboardData?.files || []).filter((file) =>
    file.type.startsWith('image/')
  )

  if (files.length > 0) return files

  return Array.from(clipboardData?.items || [])
    .filter((item) => item.type?.startsWith('image/'))
    .map((item, index) => {
      const file = item.getAsFile()
      if (!file) return null
      if (file instanceof File && file.name) return file

      return new File([file], `clipboard-image-${index + 1}.${getExtension(file.type)}`, {
        type: file.type
      })
    })
    .filter(Boolean)
}
