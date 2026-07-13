/**
 * [INPUT]: 依赖 OffscreenCanvas 2D 与 transferToImageBitmap，消费 benchScene 的图片规格
 * [OUTPUT]: 对外提供 createBenchBitmap，生成带高频细节（细线网格/文字/圆环）的程序化 ImageBitmap，用于检验 mipmap 清晰度
 * [POS]: bench 的纹理工厂，只在压测页运行，不进入正式资产管线
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export function createBenchBitmap(spec) {
  const canvas = new OffscreenCanvas(spec.width, spec.height)
  const ctx = canvas.getContext('2d')
  const { width, height, hue, label } = spec

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, `hsl(${hue}, 55%, 30%)`)
  gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 55%, 14%)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // 1px 细线网格: 缩小时最容易闪烁走样的内容，专门用来检验 mip 过滤质量
  ctx.strokeStyle = `hsla(${hue}, 70%, 70%, 0.35)`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= width; x += 32) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, height)
  }
  for (let y = 0; y <= height; y += 32) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
  }
  ctx.stroke()

  ctx.strokeStyle = `hsla(${(hue + 180) % 360}, 80%, 65%, 0.9)`
  ctx.lineWidth = Math.max(2, width / 200)
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, (Math.min(width, height) / 10) * ring, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.font = `bold ${Math.round(Math.min(width, height) / 4)}px system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, height / 2)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.font = `${Math.max(10, Math.round(width / 40))}px system-ui`
  ctx.fillText(`${width}x${height}`, width / 2, height - Math.max(16, height / 16))

  return canvas.transferToImageBitmap()
}
