import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addCategory,
  addProjectToCategory,
  createEmptyLibrary,
  removeProjectFromCategory,
  touchRecentProject
} from '../src/shared/mabelLibrary.mjs'

describe('mabel library', () => {
  it('tracks saved or opened projects only in recent projects', () => {
    const library = touchRecentProject(createEmptyLibrary(), '/tmp/demo.mabel', 'demo')

    assert.equal(library.recentProjects.length, 1)
    assert.equal(library.recentProjects[0].path, '/tmp/demo.mabel')
    assert.equal(library.categories.length, 0)
  })

  it('adds a project to a category only when explicitly requested', () => {
    let library = addCategory(createEmptyLibrary(), '角色参考')
    const categoryId = library.categories[0].id

    library = touchRecentProject(library, '/tmp/demo.mabel', 'demo')
    assert.equal(library.categories[0].items.length, 0)

    library = addProjectToCategory(library, categoryId, '/tmp/demo.mabel', 'demo')
    assert.deepEqual(library.categories[0].items.map((item) => item.path), ['/tmp/demo.mabel'])
  })

  it('removes only the category reference without changing recent projects', () => {
    let library = addCategory(createEmptyLibrary(), '角色参考')
    const categoryId = library.categories[0].id

    library = touchRecentProject(library, '/tmp/demo.mabel', 'demo')
    library = addProjectToCategory(library, categoryId, '/tmp/demo.mabel', 'demo')
    library = removeProjectFromCategory(library, categoryId, '/tmp/demo.mabel')

    assert.equal(library.recentProjects.length, 1)
    assert.equal(library.categories[0].items.length, 0)
  })

  it('moves a project between categories instead of duplicating it', () => {
    let library = addCategory(createEmptyLibrary(), '角色参考')
    library = addCategory(library, '场景参考')
    const [firstCategory, secondCategory] = library.categories

    library = addProjectToCategory(library, firstCategory.id, '/tmp/demo.mabel', 'demo')
    library = addProjectToCategory(library, secondCategory.id, '/tmp/demo.mabel', 'demo')

    assert.deepEqual(
      library.categories.map((category) => category.items.map((item) => item.path)),
      [[], ['/tmp/demo.mabel']]
    )
  })
})
