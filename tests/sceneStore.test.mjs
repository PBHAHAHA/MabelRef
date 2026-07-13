import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSceneStore } from '../src/renderer/src/engine/editor/sceneStore.mjs'

const twoNodes = () => [
  { id: 'a', x: 0, y: 0, width: 10, height: 10 },
  { id: 'b', x: 20, y: 0, width: 10, height: 10 }
]

describe('scene store', () => {
  it('replaces nodes and prunes stale selection', () => {
    const store = createSceneStore()

    store.setNodes(twoNodes())
    store.setSelection(['a', 'b'])
    store.setNodes([{ id: 'b', x: 0, y: 0, width: 5, height: 5 }])

    assert.deepEqual(store.getSelectedIds(), ['b'])
  })

  it('applies patches immutably to matching nodes only', () => {
    const store = createSceneStore()
    const original = twoNodes()

    store.setNodes(original)
    store.applyPatches(new Map([['a', { x: 99 }]]))

    assert.equal(store.getNode('a').x, 99)
    assert.equal(store.getNode('b').x, 20)
    assert.equal(original[0].x, 0)
  })

  it('toggles selection membership', () => {
    const store = createSceneStore()

    store.setNodes(twoNodes())
    store.toggleSelection('a')
    store.toggleSelection('b')
    store.toggleSelection('a')

    assert.deepEqual(store.getSelectedIds(), ['b'])
  })

  it('removes selected nodes and clears selection', () => {
    const store = createSceneStore()

    store.setNodes(twoNodes())
    store.setSelection(['a'])

    assert.equal(store.removeSelected(), 1)
    assert.deepEqual(
      store.getNodes().map((node) => node.id),
      ['b']
    )
    assert.deepEqual(store.getSelectedIds(), [])
    assert.equal(store.removeSelected(), 0)
  })

  it('notifies subscribers on every mutation and supports unsubscribe', () => {
    const store = createSceneStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls += 1
    })

    store.setNodes(twoNodes())
    store.setSelection(['a'])
    unsubscribe()
    store.removeSelected()

    assert.equal(calls, 2)
  })
})
