/**
 * [INPUT]: 依赖浏览器 createImageBitmap 重采样、OffscreenCanvas 与 HTMLImageElement 解码回退
 * [OUTPUT]: 对外提供 getDisplaySize/readImageDimensions 纯函数与 decodeDisplayBitmap，把任意图片字节解码为面积封顶的显示 ImageBitmap 并返回自然尺寸
 * [POS]: engine 的资产解码管线，GPU 纹理的唯一入口，原始 bytes 保留在资产表用于 .mabel 导出
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// 显示位图面积封顶: 限制 GPU 单级纹理的显存成本，节点仍使用自然尺寸排版
const MAX_DISPLAY_AREA = 2560 * 1600

export function getDisplaySize({ width, height, maxArea = MAX_DISPLAY_AREA }) {
  const area = width * height
  const scale = area > maxArea ? Math.sqrt(maxArea / area) : 1

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  }
}

const readUint24LE = (bytes, offset) =>
  bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)

const readUint32BE = (bytes, offset) =>
  (bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]) >>>
  0

const readJpegDimensions = (bytes) => {
  let offset = 2

  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    while (bytes[offset] === 0xff) offset += 1

    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue

    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) return null
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
        height: (bytes[offset + 3] << 8) | bytes[offset + 4]
      }
    }
    offset += length
  }

  return null
}

// Reads dimensions without rasterizing the full image. This allows large JPEG/PNG/WebP
// assets to be decoded directly at their display size instead of decode-then-resize.
export function readImageDimensions(bytes) {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) }
  }

  if (bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8) return readJpegDimensions(bytes)

  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) }
  }

  if (
    bytes.length >= 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const type = String.fromCharCode(...bytes.slice(12, 16))
    if (type === 'VP8 ' && bytes.length >= 30) {
      return {
        width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] | (bytes[29] << 8)) & 0x3fff
      }
    }
    if (type === 'VP8L' && bytes.length >= 26) {
      const value = (bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24)) >>> 0
      return { width: (value & 0x3fff) + 1, height: ((value >> 14) & 0x3fff) + 1 }
    }
    if (type === 'VP8X' && bytes.length >= 30) {
      return { width: readUint24LE(bytes, 24) + 1, height: readUint24LE(bytes, 27) + 1 }
    }
  }

  return null
}

// SVG 等 createImageBitmap 不支持的格式走 <img> 解码回退
const decodeWithImageElement = (blob) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()

    image.addEventListener('load', () => {
      const width = image.naturalWidth || 1
      const height = image.naturalHeight || 1
      const display = getDisplaySize({ width, height })
      const canvas = new OffscreenCanvas(display.width, display.height)

      canvas.getContext('2d').drawImage(image, 0, 0, display.width, display.height)
      URL.revokeObjectURL(url)
      resolve({ bitmap: canvas.transferToImageBitmap(), width, height })
    })
    image.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('Cannot decode image'))
    })
    image.src = url
  })

export async function decodeDisplayBitmap(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const naturalSize = readImageDimensions(bytes)

  if (naturalSize) {
    const display = getDisplaySize(naturalSize)
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: display.width,
      resizeHeight: display.height,
      resizeQuality: 'medium'
    })

    return { bitmap, ...naturalSize }
  }

  let decoded
  try {
    decoded = await createImageBitmap(blob)
  } catch {
    return decodeWithImageElement(blob)
  }

  const width = decoded.width
  const height = decoded.height
  const display = getDisplaySize({ width, height })

  if (display.scale === 1) return { bitmap: decoded, width, height }

  const bitmap = await createImageBitmap(decoded, {
    resizeWidth: display.width,
    resizeHeight: display.height,
    resizeQuality: 'high'
  })

  decoded.close()
  return { bitmap, width, height }
}
