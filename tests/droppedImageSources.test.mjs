import test from 'node:test'
import assert from 'node:assert/strict'
import { getDroppedImageUrls, isImageLikeUrl } from '../src/renderer/src/canvas/droppedImageSources.mjs'

const createDataTransfer = (data) => ({
  getData: (type) => data[type] || ''
})

test('extracts image src from dragged html', () => {
  const urls = getDroppedImageUrls(
    createDataTransfer({
      'text/html': '<div><img src="https://example.com/photo?id=1"></div>'
    })
  )

  assert.deepEqual(urls, ['https://example.com/photo?id=1'])
})

test('extracts first srcset candidate from dragged html', () => {
  const urls = getDroppedImageUrls(
    createDataTransfer({
      'text/html':
        '<picture><source srcset="https://example.com/small.webp 1x, https://example.com/large.webp 2x"></picture>'
    })
  )

  assert.deepEqual(urls, ['https://example.com/small.webp', 'https://example.com/large.webp'])
})

test('extracts uri-list entries and ignores comments', () => {
  const urls = getDroppedImageUrls(
    createDataTransfer({
      'text/uri-list': '# drag source\nhttps://example.com/image.png'
    })
  )

  assert.deepEqual(urls, ['https://example.com/image.png'])
})

test('accepts data image urls', () => {
  const url = 'data:image/png;base64,AAAA'
  assert.deepEqual(getDroppedImageUrls(createDataTransfer({ 'text/plain': url })), [url])
})

test('plain text must look like an image url', () => {
  assert.equal(isImageLikeUrl('https://example.com/page'), false)
  assert.deepEqual(getDroppedImageUrls(createDataTransfer({ 'text/plain': 'https://example.com/page' })), [])
})
