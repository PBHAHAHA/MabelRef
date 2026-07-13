import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decodeDisplayBitmap,
  getDisplaySize,
  readImageDimensions
} from '../src/renderer/src/engine/assetPipeline.mjs'

test('getDisplaySize keeps small images at natural size', () => {
  const size = getDisplaySize({ width: 800, height: 600 })

  assert.deepEqual(size, { width: 800, height: 600, scale: 1 })
})

test('getDisplaySize caps oversized images by area with preserved ratio', () => {
  const size = getDisplaySize({ width: 8000, height: 6000 })

  assert.ok(size.scale < 1)
  assert.ok(size.width * size.height <= 2560 * 1600 * 1.01)
  assert.ok(Math.abs(size.width / size.height - 8000 / 6000) < 0.01)
})

test('getDisplaySize never collapses extreme ratios below one pixel', () => {
  const size = getDisplaySize({ width: 10, height: 10000, maxArea: 100 })

  assert.ok(size.width >= 1)
  assert.ok(size.height >= 1)
  assert.ok(size.scale < 1)
})

test('reads PNG dimensions without decoding the bitmap', () => {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0)
  bytes.set([0, 0, 0x10, 0], 16)
  bytes.set([0, 0, 0x08, 0], 20)

  assert.deepEqual(readImageDimensions(bytes), { width: 4096, height: 2048 })
})

test('reads baseline JPEG dimensions without decoding the bitmap', () => {
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x04, 0x38, 0x07, 0x80, 0x03, 0x01, 0x11, 0x00, 0x02
  ])

  assert.deepEqual(readImageDimensions(bytes), { width: 1920, height: 1080 })
})

test('decodeDisplayBitmap reuses known natural size without reading blob bytes', async () => {
  const previousCreateImageBitmap = globalThis.createImageBitmap

  globalThis.createImageBitmap = async () => ({ width: 20, height: 10, close() {} })
  try {
    const blob = {
      async arrayBuffer() {
        throw new Error('arrayBuffer should not be read when naturalSize is known')
      }
    }

    const decoded = await decodeDisplayBitmap(blob, { naturalSize: { width: 20, height: 10 } })

    assert.equal(decoded.width, 20)
    assert.equal(decoded.height, 10)
  } finally {
    globalThis.createImageBitmap = previousCreateImageBitmap
  }
})
