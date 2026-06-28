import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  decodeMabelPackage,
  encodeMabelPackage,
  hasMabelPackageHeader,
  isMabelPackage
} from '../src/shared/mabelPackage.mjs'

describe('mabel package format', () => {
  it('stores project assets as binary files outside the manifest', () => {
    const imageBytes = Uint8Array.from([137, 80, 78, 71, 13, 10])
    const project = {
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
          bytes: imageBytes,
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
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false
        }
      ]
    }

    const encoded = encodeMabelPackage(project)
    const decoded = decodeMabelPackage(encoded)
    const manifestText = encoded.toString('utf8')

    assert.equal(isMabelPackage(encoded), true)
    assert.equal(manifestText.includes(Buffer.from(imageBytes).toString('base64')), false)
    assert.deepEqual(decoded.assets[0].bytes, imageBytes)
    assert.equal(decoded.assets[0].data, undefined)
    assert.deepEqual(decoded.nodes, project.nodes)
  })

  it('does not classify an incomplete zip header as a mabel package', () => {
    const incompleteZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])

    assert.equal(isMabelPackage(incompleteZip), false)
    assert.equal(hasMabelPackageHeader(incompleteZip), true)
  })

  it('does not classify legacy json as a mabel package candidate', () => {
    const legacyJson = Buffer.from('{"magic":"MABEL_PROJECT"}', 'utf8')

    assert.equal(isMabelPackage(legacyJson), false)
    assert.equal(hasMabelPackageHeader(legacyJson), false)
  })
})
