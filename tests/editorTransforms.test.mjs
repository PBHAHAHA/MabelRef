import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getCornerHandles,
  getEdgeHandles,
  getHandleAt,
  getHandleCursor,
  getRotationAngleDelta,
  getRotationHandle,
  getSelectionBounds,
  getUniformScale,
  moveNodePatch,
  resizeNodePatch,
  rotateNodePatch,
  scaleNodePatch
} from '../src/renderer/src/engine/editor/editorTransforms.mjs'

describe('editor transforms', () => {
  it('unions selection bounds across nodes', () => {
    const bounds = getSelectionBounds([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 200, y: 50, width: 100, height: 100 }
    ])

    assert.deepEqual(bounds, { x: 0, y: 0, width: 300, height: 150 })
    assert.equal(getSelectionBounds([]), null)
  })

  it('places corner handles with opposite anchors', () => {
    const handles = getCornerHandles({ x: 0, y: 0, width: 100, height: 50 })
    const southEast = handles.find((handle) => handle.id === 'se')

    assert.deepEqual({ x: southEast.x, y: southEast.y }, { x: 100, y: 50 })
    assert.deepEqual(southEast.anchor, { x: 0, y: 0 })
  })

  it('finds handles within the pick radius only', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 }

    assert.equal(getHandleAt(bounds, { x: 98, y: 103 }, 5)?.id, 'se')
    assert.equal(getHandleAt(bounds, { x: 50, y: 2 }, 5)?.id, 'n')
    assert.equal(getHandleAt(bounds, { x: 80, y: 80 }, 5), null)
  })

  it('places edge and rotation handles', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 50 }
    const east = getEdgeHandles(bounds).find((handle) => handle.id === 'e')
    const rotate = getRotationHandle(bounds, 30)

    assert.deepEqual({ x: east.x, y: east.y }, { x: 110, y: 45 })
    assert.deepEqual(east.anchor, { x: 10, y: 45 })
    assert.deepEqual({ x: rotate.x, y: rotate.y }, { x: 60, y: -10 })
  })

  it('maps transform handles to cursor styles', () => {
    assert.equal(getHandleCursor({ id: 'n' }), 'ns-resize')
    assert.equal(getHandleCursor({ id: 'e' }), 'ew-resize')
    assert.equal(getHandleCursor({ id: 'ne' }), 'nesw-resize')
    assert.equal(getHandleCursor({ id: 'se' }), 'nwse-resize')
    assert.equal(getHandleCursor({ id: 'rotate' }), 'grab')
    assert.equal(getHandleCursor(null), 'default')
  })

  it('uniform scale is the projection ratio along the handle axis', () => {
    const handle = { x: 100, y: 100, anchor: { x: 0, y: 0 } }

    assert.equal(getUniformScale({ handle, point: { x: 200, y: 200 } }), 2)
    assert.equal(getUniformScale({ handle, point: { x: 50, y: 50 } }), 0.5)
  })

  it('clamps uniform scale to the minimum instead of flipping', () => {
    const handle = { x: 100, y: 100, anchor: { x: 0, y: 0 } }

    assert.equal(getUniformScale({ handle, point: { x: -100, y: -100 }, minScale: 0.01 }), 0.01)
  })

  it('scales node position and scale about a world anchor', () => {
    const patch = scaleNodePatch({ x: 100, y: 100, scaleX: 1, scaleY: 1 }, { x: 0, y: 0 }, 2)

    assert.deepEqual(patch, { x: 200, y: 200, scaleX: 2, scaleY: 2 })
  })

  it('resizes from side handles uniformly', () => {
    const node = { x: 10, y: 20, width: 100, height: 50, scaleX: 1, scaleY: 1 }
    const bounds = { x: 10, y: 20, width: 100, height: 50 }
    const east = getEdgeHandles(bounds).find((handle) => handle.id === 'e')
    const north = getEdgeHandles(bounds).find((handle) => handle.id === 'n')

    assert.deepEqual(resizeNodePatch(node, bounds, east, { x: 210, y: 45 }), {
      x: 10,
      y: -5,
      scaleX: 2,
      scaleY: 2
    })
    assert.deepEqual(resizeNodePatch(node, bounds, north, { x: 60, y: -30 }), {
      x: -40,
      y: -30,
      scaleX: 2,
      scaleY: 2
    })
  })

  it('keeps rotation untouched by uniform scaling', () => {
    const node = { x: 10, y: 10, scaleX: 0.5, scaleY: 0.5, rotation: 30 }
    const patch = scaleNodePatch(node, { x: 10, y: 10 }, 3)

    assert.equal(patch.scaleX, 1.5)
    assert.equal('rotation' in patch, false)
  })

  it('moves nodes by a world delta', () => {
    assert.deepEqual(moveNodePatch({ x: 5, y: 5 }, { x: -3, y: 10 }), { x: 2, y: 15 })
  })

  it('computes rotation deltas and patches node rotation', () => {
    const delta = getRotationAngleDelta({
      center: { x: 0, y: 0 },
      start: { x: 1, y: 0 },
      point: { x: 0, y: 1 }
    })

    assert.equal(delta, 90)
    const patch = rotateNodePatch({ x: 0, y: 0, width: 100, height: 50, rotation: 0 }, delta)

    assert.equal(patch.rotation, 90)
    assert.ok(Math.abs(patch.x - 75) < 1e-9)
    assert.ok(Math.abs(patch.y + 25) < 1e-9)
  })
})
