import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTransformHistoryRecorder } from '../src/renderer/src/canvas/canvasTransformHistory.mjs'

describe('canvas transform history recorder', () => {
  it('records only once during one continuous transform', () => {
    let remembers = 0
    const recorder = createTransformHistoryRecorder(() => {
      remembers += 1
    })

    recorder.remember()
    recorder.remember()
    recorder.remember()

    assert.equal(remembers, 1)
  })

  it('records the next transform after reset', () => {
    let remembers = 0
    const recorder = createTransformHistoryRecorder(() => {
      remembers += 1
    })

    recorder.remember()
    recorder.reset()
    recorder.remember()

    assert.equal(remembers, 2)
  })

  it('keeps non-drag transform bursts as one undo transaction too', () => {
    let remembers = 0
    const recorder = createTransformHistoryRecorder(() => {
      remembers += 1
    })

    recorder.remember()
    recorder.remember()

    assert.equal(remembers, 1)
  })
})
