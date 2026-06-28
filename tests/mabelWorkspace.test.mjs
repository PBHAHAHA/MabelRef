import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createRenamedMabelPath,
  createWorkspaceManifest,
  isPathInside,
  normalizeWorkspaceTree
} from '../src/shared/mabelWorkspace.mjs'

describe('mabel workspace model', () => {
  it('creates a stable workspace manifest', () => {
    assert.deepEqual(
      createWorkspaceManifest({
        name: 'Reference Boards',
        createdAt: '2026-06-28T00:00:00.000Z'
      }),
      {
        magic: 'MABEL_WORKSPACE',
        version: 1,
        name: 'Reference Boards',
        createdAt: '2026-06-28T00:00:00.000Z'
      }
    )
  })

  it('normalizes folders into categories and mabel files into canvases', () => {
    const tree = normalizeWorkspaceTree({
      rootPath: '/workspace',
      entries: [
        {
          name: '人物',
          path: '/workspace/人物',
          files: [
            { name: '角色参考.mabel', path: '/workspace/人物/角色参考.mabel' },
            { name: '.hidden.mabel', path: '/workspace/人物/.hidden.mabel' },
            { name: 'notes.txt', path: '/workspace/人物/notes.txt' }
          ]
        },
        {
          name: '.cache',
          path: '/workspace/.cache',
          files: [{ name: 'skip.mabel', path: '/workspace/.cache/skip.mabel' }]
        },
        {
          name: '场景',
          path: '/workspace/场景',
          files: [{ name: '城市.mabel', path: '/workspace/场景/城市.mabel' }]
        }
      ]
    })

    assert.deepEqual(tree, {
      rootPath: '/workspace',
      name: 'workspace',
      categories: [
        {
          id: '/workspace/人物',
          name: '人物',
          path: '/workspace/人物',
          count: 1,
          projects: [
            {
              id: '/workspace/人物/角色参考.mabel',
              name: '角色参考',
              path: '/workspace/人物/角色参考.mabel'
            }
          ]
        },
        {
          id: '/workspace/场景',
          name: '场景',
          path: '/workspace/场景',
          count: 1,
          projects: [
            {
              id: '/workspace/场景/城市.mabel',
              name: '城市',
              path: '/workspace/场景/城市.mabel'
            }
          ]
        }
      ]
    })
  })

  it('checks whether file operations stay inside the workspace', () => {
    assert.equal(isPathInside('/workspace', '/workspace/人物/角色.mabel'), true)
    assert.equal(isPathInside('/workspace', '/workspace'), true)
    assert.equal(isPathInside('/workspace', '/workspace-other/file.mabel'), false)
    assert.equal(isPathInside('/workspace', '/tmp/file.mabel'), false)
  })

  it('creates renamed mabel paths inside the same category', () => {
    assert.equal(
      createRenamedMabelPath('/workspace/人物/旧名字.mabel', '新名字'),
      '/workspace/人物/新名字.mabel'
    )
    assert.equal(
      createRenamedMabelPath('/workspace/人物/旧名字.mabel', '新名字.mabel'),
      '/workspace/人物/新名字.mabel'
    )
    assert.equal(
      createRenamedMabelPath('/workspace/人物/旧名字.mabel', '角色/参考'),
      '/workspace/人物/角色-参考.mabel'
    )
  })
})
