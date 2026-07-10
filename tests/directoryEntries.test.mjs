import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectDroppedFiles } from '../src/renderer/src/canvas/directoryEntries.mjs'

const fileEntry = (file) => ({
  isFile: true,
  isDirectory: false,
  file: (resolve) => resolve(file)
})

const directoryEntry = (batches) => ({
  isFile: false,
  isDirectory: true,
  createReader: () => {
    let index = 0

    return {
      readEntries: (resolve) => resolve(batches[index++] || [])
    }
  }
})

const itemFromEntry = (entry) => ({
  webkitGetAsEntry: () => entry
})

describe('directory entry imports', () => {
  it('recursively expands dropped folders into files', async () => {
    const cover = new File(['cover'], 'cover.png', { type: 'image/png' })
    const nested = new File(['nested'], 'nested.jpg', { type: 'image/jpeg' })
    const entry = directoryEntry([
      [
        fileEntry(cover),
        directoryEntry([[fileEntry(nested)], []])
      ],
      []
    ])

    const files = await collectDroppedFiles({ items: [itemFromEntry(entry)] })

    assert.deepEqual(
      files.map((file) => file.name),
      ['cover.png', 'nested.jpg']
    )
  })

  it('falls back to dataTransfer files when entries are unavailable', async () => {
    const image = new File(['image'], 'image.webp', { type: 'image/webp' })
    const files = await collectDroppedFiles({ files: [image], items: [] })

    assert.deepEqual(files, [image])
  })

  it('merges dataTransfer files when item entries omit some dropped files', async () => {
    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const second = new File(['second'], 'second.png', { type: 'image/png' })
    const files = await collectDroppedFiles({
      files: [first, second],
      items: [itemFromEntry(fileEntry(first))]
    })

    assert.deepEqual(
      files.map((file) => file.name),
      ['first.png', 'second.png']
    )
  })

  it('prefers direct dataTransfer files for regular multi-file drops', async () => {
    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const second = new File(['second'], 'second.png', { type: 'image/png' })
    const omitted = new File(['omitted'], 'omitted.png', { type: 'image/png' })
    const files = await collectDroppedFiles({
      files: [first, second],
      items: [itemFromEntry(fileEntry(omitted))]
    })

    assert.deepEqual(
      files.map((file) => file.name),
      ['first.png', 'second.png']
    )
  })
})
