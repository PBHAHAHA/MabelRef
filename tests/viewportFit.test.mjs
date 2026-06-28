import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getContentBounds, getFitView } from '../src/renderer/src/canvas/viewportFit.mjs'

describe('viewport fit', () => {
  it('computes content bounds from positioned nodes', () => {
    const bounds = getContentBounds([
      { x: 10, y: 20, width: 300, height: 200 },
      { x: 400, y: 50, width: 100, height: 80 }
    ])

    assert.deepEqual(bounds, { x: 10, y: 20, width: 490, height: 200 })
  })

  it('fits content into viewport and centers it', () => {
    const view = getFitView({
      bounds: { x: 10, y: 20, width: 1000, height: 500 },
      viewport: { width: 500, height: 300 },
      padding: 20
    })

    assert.equal(view.zoom, 0.46)
    assert.deepEqual(view.position, { x: 15.4, y: 25.8 })
  })
})
