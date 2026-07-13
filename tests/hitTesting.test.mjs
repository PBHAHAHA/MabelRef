import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getIdsInRect,
  getNodeAabb,
  getNodeCorners,
  getTopmostHit,
  hitsNode,
  normalizeRect
} from '../src/renderer/src/engine/editor/hitTesting.mjs'

describe('editor hit testing', () => {
  it('computes corners for an axis aligned node', () => {
    const corners = getNodeCorners({ x: 10, y: 20, width: 100, height: 50 })

    assert.deepEqual(corners[0], { x: 10, y: 20 })
    assert.deepEqual(corners[2], { x: 110, y: 70 })
  })

  it('applies node scale to hit bounds', () => {
    const node = { x: 0, y: 0, width: 100, height: 100, scaleX: 0.5, scaleY: 0.5 }

    assert.equal(hitsNode(node, { x: 40, y: 40 }), true)
    assert.equal(hitsNode(node, { x: 60, y: 60 }), false)
  })

  it('hits rotated nodes in their rotated footprint', () => {
    const node = { x: 100, y: 100, width: 100, height: 10, rotation: 90 }

    // 旋转 90 度后矩形垂直向下延伸
    assert.equal(hitsNode(node, { x: 95, y: 150 }), true)
    assert.equal(hitsNode(node, { x: 150, y: 105 }), false)
  })

  it('aabb of a rotated node covers the rotated footprint', () => {
    const aabb = getNodeAabb({ x: 0, y: 0, width: 100, height: 100, rotation: 45 })

    assert.ok(Math.abs(aabb.width - 100 * Math.SQRT2) < 1e-9)
    assert.ok(aabb.x < 0)
  })

  it('returns the topmost node when several overlap', () => {
    const bottom = { id: 'a', x: 0, y: 0, width: 100, height: 100 }
    const top = { id: 'b', x: 50, y: 50, width: 100, height: 100 }

    assert.equal(getTopmostHit([bottom, top], { x: 75, y: 75 }), top)
    assert.equal(getTopmostHit([bottom, top], { x: 10, y: 10 }), bottom)
    assert.equal(getTopmostHit([bottom, top], { x: 500, y: 500 }), null)
  })

  it('normalizes rects from any drag direction', () => {
    assert.deepEqual(normalizeRect({ x: 100, y: 100 }, { x: 20, y: 40 }), {
      x: 20,
      y: 40,
      width: 80,
      height: 60
    })
  })

  it('box select collects nodes intersecting the marquee', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, width: 50, height: 50 },
      { id: 'b', x: 200, y: 200, width: 50, height: 50 },
      { id: 'c', x: 40, y: 40, width: 50, height: 50 }
    ]

    assert.deepEqual(getIdsInRect(nodes, { x: 10, y: 10, width: 60, height: 60 }), ['a', 'c'])
  })
})
