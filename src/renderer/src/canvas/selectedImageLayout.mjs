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
