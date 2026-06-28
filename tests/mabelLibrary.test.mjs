import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLibraryTree } from '../src/shared/mabelLibrary.mjs'

describe('mabel library tree', () => {
  it('builds categories from folders and mabel files', () => {
    const tree = createLibraryTree({
      rootPath: '/Users/pub/Documents/Mabel Library',
      entries: [
        {
          name: '人物',
          path: '/Users/pub/Documents/Mabel Library/人物',
          files: [
            { name: '主角.mabel', path: '/Users/pub/Documents/Mabel Library/人物/主角.mabel' },
            { name: 'readme.txt', path: '/Users/pub/Documents/Mabel Library/人物/readme.txt' }
          ]
        },
        {
          name: '场景',
          path: '/Users/pub/Documents/Mabel Library/场景',
          files: [
            { name: '街道.mabel', path: '/Users/pub/Documents/Mabel Library/场景/街道.mabel' }
          ]
        }
      ]
    })

    assert.deepEqual(tree, {
      rootPath: '/Users/pub/Documents/Mabel Library',
      name: 'Mabel Library',
      categories: [
        {
          id: '/Users/pub/Documents/Mabel Library/人物',
          name: '人物',
          path: '/Users/pub/Documents/Mabel Library/人物',
          count: 1,
          projects: [
            {
              id: '/Users/pub/Documents/Mabel Library/人物/主角.mabel',
              name: '主角',
              path: '/Users/pub/Documents/Mabel Library/人物/主角.mabel'
            }
          ]
        },
        {
          id: '/Users/pub/Documents/Mabel Library/场景',
          name: '场景',
          path: '/Users/pub/Documents/Mabel Library/场景',
          count: 1,
          projects: [
            {
              id: '/Users/pub/Documents/Mabel Library/场景/街道.mabel',
              name: '街道',
              path: '/Users/pub/Documents/Mabel Library/场景/街道.mabel'
            }
          ]
        }
      ]
    })
  })
})
