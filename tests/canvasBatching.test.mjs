import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chunkItems } from '../src/renderer/src/canvas/canvasBatching.mjs'

describe('canvas batching', () => {
  it('splits canvas nodes into stable batches', () => {
    const items = Array.from({ length: 10 }, (_, index) => index)

    assert.deepEqual(chunkItems(items, 3), [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]])
  })

  it('uses a single batch when the batch size is larger than the list', () => {
    assert.deepEqual(chunkItems(['a', 'b'], 10), [['a', 'b']])
  })
})
