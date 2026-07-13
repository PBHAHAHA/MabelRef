/**
 * [INPUT]: 依赖 imagePacking 的装箱算法与 viewportFit 的内容包围盒
 * [OUTPUT]: 对外提供 getNodeLayoutSize 与 getSelectedImageLayout，按含缩放的节点尺寸在原包围盒锚点处重排选中图片
 * [POS]: renderer/canvas 的选中排版纯函数，被 engine/useEngineImageEditor 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { packImages } from './imagePacking.mjs'
import { getContentBounds } from './viewportFit.mjs'

export const getNodeLayoutSize = (node) => ({
  width: Math.max(1, Math.abs((node.width || 1) * (node.scaleX ?? 1))),
  height: Math.max(1, Math.abs((node.height || 1) * (node.scaleY ?? 1)))
})

export function getSelectedImageLayout({ records, viewportWidth, gap }) {
  const bounds = getContentBounds(
    records.map((file) => {
      const size = getNodeLayoutSize(file.node)

      return {
        x: file.node.x || 0,
        y: file.node.y || 0,
        width: size.width,
        height: size.height
      }
    })
  )
  const layout = packImages({
    items: records.map((file) => getNodeLayoutSize(file.node)),
    viewportWidth: viewportWidth || bounds.width,
    gap,
    origin: 0
  })

  return layout.map((item) => ({
    ...item,
    x: bounds.x + item.x,
    y: bounds.y + item.y
  }))
}
