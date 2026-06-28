import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { packImages } from '../src/renderer/src/canvas/imagePacking.mjs'

describe('image packing layout', () => {
  it('keeps natural image sizes and packs items tightly', () => {
    const layout = packImages({
      items: [
        { width: 300, height: 200 },
        { width: 200, height: 100 },
        { width: 160, height: 240 }
      ],
      viewportWidth: 560,
      gap: 10,
      origin: 10
    })

    assert.deepEqual(layout, [
      { x: 10, y: 10, width: 300, height: 200 },
      { x: 10, y: 220, width: 200, height: 100 },
      { x: 320, y: 10, width: 160, height: 240 }
    ])
  })

  it('keeps an image wider than the viewport at natural size', () => {
    const layout = packImages({
      items: [
        { width: 1200, height: 800 },
        { width: 200, height: 100 }
      ],
      viewportWidth: 560,
      gap: 10,
      origin: 10
    })

    assert.deepEqual(layout[0], { x: 10, y: 10, width: 1200, height: 800 })
    assert.equal(layout[1].width, 200)
    assert.equal(layout[1].height, 100)
  })

  it('packs larger images first but returns positions in original order', () => {
    const layout = packImages({
      items: [
        { width: 100, height: 100 },
        { width: 400, height: 300 },
        { width: 120, height: 160 }
      ],
      viewportWidth: 700,
      gap: 10,
      origin: 10
    })

    assert.deepEqual(layout[1], { x: 10, y: 10, width: 400, height: 300 })
    assert.equal(layout[0].width, 100)
    assert.equal(layout[2].height, 160)
  })
})
