import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createEmptyMabelProject,
  decodeMabelProject,
  encodeMabelProject
} from '../src/shared/mabelProject.mjs'

describe('mabel project format', () => {
  it('creates an empty canvas project', () => {
    assert.deepEqual(createEmptyMabelProject(), {
      version: 1,
      canvas: {
        zoom: 1,
        background: 'dot-grid'
      },
      assets: [],
      nodes: []
    })
  })

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
          scaleX: 1.4,
          scaleY: 0.8,
          rotation: 15,
          skewX: 4,
          skewY: -2,
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
