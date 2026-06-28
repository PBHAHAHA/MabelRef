import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getClipboardImageFiles } from '../src/renderer/src/canvas/clipboardImages.mjs'

describe('clipboard image extraction', () => {
  it('extracts image files from clipboard files', () => {
    const image = new File(['image'], 'screen.png', { type: 'image/png' })
    const text = new File(['text'], 'note.txt', { type: 'text/plain' })
    const files = getClipboardImageFiles({
      files: [image, text],
      items: []
    })

    assert.deepEqual(files, [image])
  })

  it('creates named files from image clipboard items', () => {
    const blob = new Blob(['image'], { type: 'image/png' })
    const files = getClipboardImageFiles({
      files: [],
      items: [{ type: 'image/png', getAsFile: () => blob }]
    })

    assert.equal(files.length, 1)
    assert.equal(files[0].name, 'clipboard-image-1.png')
    assert.equal(files[0].type, 'image/png')
  })
})
