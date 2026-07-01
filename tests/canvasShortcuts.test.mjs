import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCanvasShortcut } from '../src/renderer/src/canvas/canvasShortcuts.mjs'

describe('canvas keyboard shortcuts', () => {
  it('maps ctrl or command s to save', () => {
    assert.equal(getCanvasShortcut({ key: 's', ctrlKey: true, metaKey: false }), 'save')
    assert.equal(getCanvasShortcut({ key: 'S', ctrlKey: false, metaKey: true }), 'save')
  })

  it('maps ctrl or command r to arrange selected images', () => {
    assert.equal(getCanvasShortcut({ key: 'r', ctrlKey: true, metaKey: false }), 'arrange')
    assert.equal(getCanvasShortcut({ key: 'R', ctrlKey: false, metaKey: true }), 'arrange')
  })

  it('maps ctrl or command z to undo canvas edits', () => {
    assert.equal(getCanvasShortcut({ key: 'z', ctrlKey: true, metaKey: false }), 'undo')
    assert.equal(getCanvasShortcut({ key: 'Z', ctrlKey: false, metaKey: true }), 'undo')
  })

  it('ignores unrelated shortcuts', () => {
    assert.equal(getCanvasShortcut({ key: 's', ctrlKey: false, metaKey: false }), null)
    assert.equal(getCanvasShortcut({ key: 'x', ctrlKey: true, metaKey: false }), null)
  })
})
