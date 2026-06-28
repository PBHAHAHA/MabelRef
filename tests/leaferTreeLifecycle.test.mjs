import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { destroyTreeChildren } from '../src/renderer/src/canvas/leaferTreeLifecycle.mjs'

describe('leafer tree lifecycle', () => {
  it('destroys every child even when destroy mutates the live children array', () => {
    const destroyed = []
    const tree = {
      children: []
    }

    const createChild = (id) => ({
      id,
      destroy() {
        destroyed.push(id)
        tree.children.splice(tree.children.indexOf(this), 1)
      }
    })

    tree.children.push(createChild('first'), createChild('second'), createChild('third'))

    destroyTreeChildren(tree)

    assert.deepEqual(destroyed, ['first', 'second', 'third'])
    assert.deepEqual(tree.children, [])
  })
})
