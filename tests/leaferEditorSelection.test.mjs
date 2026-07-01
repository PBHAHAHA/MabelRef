import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { syncEditorSelectionOverlay } from '../src/renderer/src/canvas/leaferEditorSelection.mjs'

describe('leafer editor selection overlay', () => {
  it('refreshes the edit box after manual viewport changes', () => {
    let editBoxUpdates = 0
    let editToolUpdates = 0

    syncEditorSelectionOverlay({
      updateEditBox: () => {
        editBoxUpdates += 1
      },
      updateEditTool: () => {
        editToolUpdates += 1
      }
    })

    assert.equal(editBoxUpdates, 1)
    assert.equal(editToolUpdates, 1)
  })

  it('ignores missing editor instances', () => {
    assert.doesNotThrow(() => syncEditorSelectionOverlay(null))
  })
})
