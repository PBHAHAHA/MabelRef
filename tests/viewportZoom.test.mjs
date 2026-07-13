import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getAnchoredZoomView,
  getPannedView,
  getWheelZoomFactor
} from '../src/renderer/src/canvas/viewportZoom.mjs'

describe('viewport anchored zoom', () => {
  it('keeps the canvas point under the anchor fixed while zooming', () => {
    const view = getAnchoredZoomView({
      anchor: { x: 200, y: 120 },
      currentPosition: { x: 20, y: -30 },
      currentZoom: 2,
      nextZoom: 4
    })

    assert.deepEqual(view, {
      nextZoom: 4,
      position: { x: -160, y: -180 }
    })
  })

  it('keeps the anchored canvas point stable after applying the computed position', () => {
    const anchor = { x: 480, y: 260 }
    const currentPosition = { x: -140, y: 36 }
    const currentZoom = 0.75
    const nextZoom = 0.9
    const canvasPoint = {
      x: (anchor.x - currentPosition.x) / currentZoom,
      y: (anchor.y - currentPosition.y) / currentZoom
    }
    const view = getAnchoredZoomView({ anchor, currentPosition, currentZoom, nextZoom })

    assert.equal(canvasPoint.x * view.nextZoom + view.position.x, anchor.x)
    assert.equal(canvasPoint.y * view.nextZoom + view.position.y, anchor.y)
  })

  it('uses smaller bounded wheel zoom steps', () => {
    assert.equal(getWheelZoomFactor(-100), 1.45)
    assert.equal(getWheelZoomFactor(100), 0.65)
    assert.equal(getWheelZoomFactor(-1000), 1.5)
    assert.equal(getWheelZoomFactor(1000), 0.65)
    assert.ok(getWheelZoomFactor(-10) > 1)
    assert.ok(getWheelZoomFactor(-10) < 1.06)
    assert.ok(getWheelZoomFactor(10) < 1)
    assert.ok(getWheelZoomFactor(10) > 0.94)
  })

  it('moves the viewport opposite to trackpad wheel deltas while panning', () => {
    assert.deepEqual(
      getPannedView({
        currentPosition: { x: 120, y: -80 },
        delta: { x: 24, y: -36 }
      }),
      {
        position: { x: 96, y: -44 }
      }
    )
  })
})
