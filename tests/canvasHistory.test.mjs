import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCanvasHistory } from '../src/renderer/src/canvas/canvasHistory.mjs'

describe('canvas history', () => {
  it('restores snapshots in reverse order', () => {
    const history = createCanvasHistory()
    const first = { nodes: [{ id: 'a', x: 1 }] }
    const second = { nodes: [{ id: 'a', x: 2 }] }

    history.push(first)
    history.push(second)

    assert.deepEqual(history.undo(), second)
    assert.deepEqual(history.undo(), first)
    assert.equal(history.undo(), null)
  })

  it('stores cloned snapshots so later mutation does not rewrite history', () => {
    const history = createCanvasHistory()
    const snapshot = { nodes: [{ id: 'a', x: 1 }] }

    history.push(snapshot)
    snapshot.nodes[0].x = 99

    assert.deepEqual(history.undo(), { nodes: [{ id: 'a', x: 1 }] })
  })

  it('clears all stored snapshots', () => {
    const history = createCanvasHistory()

    history.push({ nodes: [{ id: 'a' }] })
    history.clear()

    assert.equal(history.undo(), null)
  })
})
