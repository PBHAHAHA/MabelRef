import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getDroppedMabelProjectPath,
  getImageFiles,
  isMabelProjectFile
} from '../src/renderer/src/canvas/canvasImportFiles.mjs'

describe('canvas import files', () => {
  it('detects mabel project files by extension', () => {
    assert.equal(isMabelProjectFile({ name: 'Board.mabel' }), true)
    assert.equal(isMabelProjectFile({ name: 'Board.MABEL' }), true)
    assert.equal(isMabelProjectFile({ name: 'photo.png' }), false)
  })

  it('keeps image files separate from mabel project files', () => {
    const files = [
      { name: 'Board.mabel', type: '' },
      { name: 'photo.png', type: 'image/png' },
      { name: 'notes.txt', type: 'text/plain' }
    ]

    assert.deepEqual(getImageFiles(files), [{ name: 'photo.png', type: 'image/png' }])
  })

  it('returns the first dropped mabel project path', () => {
    const files = [{ name: 'photo.png' }, { name: 'Board.mabel' }]
    const getPath = (file) => `/projects/${file.name}`

    assert.equal(getDroppedMabelProjectPath(files, getPath), '/projects/Board.mabel')
  })
})
