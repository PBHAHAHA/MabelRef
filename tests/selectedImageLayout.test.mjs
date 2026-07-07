import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getSelectedImageLayout } from '../src/renderer/src/canvas/selectedImageLayout.mjs'

const record = ({ x, y, width, height, scaleX = 1, scaleY = 1 }) => ({
  node: { x, y, width, height, scaleX, scaleY }
})

describe('selected image layout', () => {
  it('uses viewport width instead of the previous selection spread', () => {
    const layout = getSelectedImageLayout({
      records: [
        record({ x: 0, y: 0, width: 300, height: 200 }),
        record({ x: 900, y: 0, width: 200, height: 100 }),
        record({ x: 1200, y: 0, width: 160, height: 240 })
      ],
      viewportWidth: 560,
      gap: 10
    })

    assert.deepEqual(layout, [
      { x: 0, y: 0, width: 300, height: 200 },
      { x: 0, y: 210, width: 200, height: 100 },
      { x: 310, y: 0, width: 160, height: 240 }
    ])
  })

  it('packs by visible scaled image size', () => {
    const layout = getSelectedImageLayout({
      records: [
        record({ x: 50, y: 60, width: 100, height: 100, scaleX: 2, scaleY: 1.5 }),
        record({ x: 200, y: 60, width: 120, height: 100 })
      ],
      viewportWidth: 260,
      gap: 10
    })

    assert.equal(layout[0].width, 200)
    assert.equal(layout[0].height, 150)
    assert.equal(layout[1].y, 220)
  })
})
