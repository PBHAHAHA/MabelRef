import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encodeMabelProject, decodeMabelProject } from '../src/shared/mabelProject.mjs'

describe('mabel project format', () => {
  it('preserves canvas nodes and embedded image assets', () => {
    const source = {
      version: 1,
      canvas: {
        zoom: 1,
        background: 'dot-grid'
      },
      assets: [
        {
          id: 'asset-1',
          name: 'sample.png',
          mime: 'image/png',
          data: Buffer.from('image bytes').toString('base64'),
          originalPath: '/Users/pub/Pictures/sample.png'
        }
      ],
      nodes: [
        {
          id: 'node-1',
          type: 'image',
          assetId: 'asset-1',
          name: 'sample.png',
          x: 24,
          y: 36,
          width: 220,
          height: 160,
          rotation: 15,
          opacity: 0.8,
          visible: true,
          locked: false
        }
      ]
    }

    const encoded = encodeMabelProject(source)
    const decoded = decodeMabelProject(encoded)

    assert.deepEqual(decoded, source)
  })
})
