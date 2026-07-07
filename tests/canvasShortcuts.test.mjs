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

  it('maps ctrl or command y to redo canvas edits', () => {
    assert.equal(getCanvasShortcut({ key: 'y', ctrlKey: true, metaKey: false }), 'redo')
    assert.equal(getCanvasShortcut({ key: 'Y', ctrlKey: false, metaKey: true }), 'redo')
  })

  it('maps ctrl or command arrows to layer movement', () => {
    assert.equal(getCanvasShortcut({ key: 'ArrowUp', ctrlKey: true, metaKey: false }), 'layer-up')
    assert.equal(
      getCanvasShortcut({ key: 'ArrowDown', ctrlKey: false, metaKey: true }),
      'layer-down'
    )
  })

  it('maps delete keys to delete selected images', () => {
    assert.equal(getCanvasShortcut({ key: 'Delete', ctrlKey: false, metaKey: false }), 'delete')
    assert.equal(getCanvasShortcut({ key: 'Backspace', ctrlKey: false, metaKey: false }), 'delete')
  })

  it('ignores unrelated shortcuts', () => {
    assert.equal(getCanvasShortcut({ key: 's', ctrlKey: false, metaKey: false }), null)
    assert.equal(getCanvasShortcut({ key: 'x', ctrlKey: true, metaKey: false }), null)
  })
})
