import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getCornerHandles,
  getHandleAt,
  getSelectionBounds,
  getUniformScale,
  moveNodePatch,
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
    assert.equal(getHandleAt(bounds, { x: 80, y: 80 }, 5), null)
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

  it('keeps rotation untouched by uniform scaling', () => {
    const node = { x: 10, y: 10, scaleX: 0.5, scaleY: 0.5, rotation: 30 }
    const patch = scaleNodePatch(node, { x: 10, y: 10 }, 3)

    assert.equal(patch.scaleX, 1.5)
    assert.equal('rotation' in patch, false)
  })

  it('moves nodes by a world delta', () => {
    assert.deepEqual(moveNodePatch({ x: 5, y: 5 }, { x: -3, y: 10 }), { x: 2, y: 15 })
  })
})
