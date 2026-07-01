import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  decodeMabelPackage,
  encodeMabelPackage,
  hasMabelPackageHeader,
  isMabelPackage,
  writeMabelPackage
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

  it('writes a package directly to disk without changing the decoded project', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mabel-package-'))
    const filePath = join(directory, 'streamed.mabel')
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
          bytes: Uint8Array.from([1, 2, 3, 4]),
          originalPath: '/Users/pub/Pictures/sample.png'
        }
      ],
      nodes: [
        {
          id: 'node-1',
          type: 'image',
          assetId: 'asset-1',
          name: 'sample.png',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false
        }
      ]
    }

    try {
      await writeMabelPackage(filePath, project)

      assert.deepEqual(decodeMabelPackage(await readFile(filePath)), project)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('reports save progress for manifest, assets, and package finalization', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mabel-package-'))
    const filePath = join(directory, 'progress.mabel')
    const progressEvents = []
    const project = {
      version: 1,
      canvas: {
        zoom: 1,
        background: 'dot-grid'
      },
      assets: [
        {
          id: 'asset-1',
          name: 'a.png',
          mime: 'image/png',
          bytes: Uint8Array.from([1]),
          originalPath: ''
        },
        {
          id: 'asset-2',
          name: 'b.png',
          mime: 'image/png',
          bytes: Uint8Array.from([2]),
          originalPath: ''
        }
      ],
      nodes: []
    }

    try {
      await writeMabelPackage(filePath, project, (progress) => progressEvents.push(progress))

      assert.deepEqual(
        progressEvents.map((event) => event.phase),
        ['manifest', 'asset', 'asset', 'finalizing', 'done']
      )
      assert.deepEqual(
        progressEvents.map((event) => event.writtenEntries),
        [1, 2, 3, 3, 3]
      )
      assert.equal(progressEvents.at(-1).totalEntries, 3)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
