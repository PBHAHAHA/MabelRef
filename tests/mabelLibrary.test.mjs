import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addCategory,
  addProjectToCategory,
  createEmptyLibrary,
  normalizeLibrary,
  removeProjectFromCategory,
  renameProject,
  setCategoryFolderPath
} from '../src/shared/mabelLibrary.mjs'

describe('mabel library', () => {
  it('keeps workspace and category folder paths in the library model', () => {
    let library = normalizeLibrary({
      ...createEmptyLibrary(),
      workspacePath: '/tmp/mabel-workspace',
      rootProjects: [{ path: '/tmp/mabel-workspace/demo.mabel', name: 'demo' }]
    })
    library = addCategory(library, '人物')
    library = setCategoryFolderPath(library, library.categories[0].id, '/tmp/mabel-workspace/人物')
    library = normalizeLibrary(library)

    assert.equal(library.workspacePath, '/tmp/mabel-workspace')
    assert.equal(library.rootProjects[0].path, '/tmp/mabel-workspace/demo.mabel')
    assert.equal(library.categories[0].folderPath, '/tmp/mabel-workspace/人物')
  })

  it('adds a project to a category only when explicitly requested', () => {
    let library = addCategory(createEmptyLibrary(), '角色参考')
    const categoryId = library.categories[0].id

    assert.equal(library.categories[0].items.length, 0)

    library = addProjectToCategory(library, categoryId, '/tmp/demo.mabel', 'demo')
    assert.deepEqual(library.categories[0].items.map((item) => item.path), ['/tmp/demo.mabel'])
  })

  it('removes only the category reference', () => {
    let library = addCategory(createEmptyLibrary(), '角色参考')
    const categoryId = library.categories[0].id

    library = addProjectToCategory(library, categoryId, '/tmp/demo.mabel', 'demo')
    library = removeProjectFromCategory(library, categoryId, '/tmp/demo.mabel')

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

  it('moves a root project into a category instead of showing it twice', () => {
    let library = normalizeLibrary({
      ...createEmptyLibrary(),
      rootProjects: [{ path: '/tmp/demo.mabel', name: 'demo' }]
    })
    library = addCategory(library, 'refs')
    library = addProjectToCategory(library, library.categories[0].id, '/tmp/demo.mabel', 'demo')

    assert.equal(library.rootProjects.length, 0)
    assert.equal(library.categories[0].items[0].path, '/tmp/demo.mabel')
  })

  it('renames a project across root and category references', () => {
    let library = normalizeLibrary({
      ...createEmptyLibrary(),
      rootProjects: [{ path: '/tmp/demo.mabel', name: 'demo' }],
      categories: [
        {
          id: 'cat-refs',
          name: 'refs',
          folderPath: '/tmp/refs',
          items: [{ path: '/tmp/demo.mabel', name: 'demo' }]
        }
      ]
    })

    library = renameProject(library, '/tmp/demo.mabel', '/tmp/renamed.mabel', 'renamed')

    assert.equal(library.rootProjects[0].path, '/tmp/renamed.mabel')
    assert.equal(library.rootProjects[0].name, 'renamed')
    assert.equal(library.categories[0].items[0].path, '/tmp/renamed.mabel')
    assert.equal(library.categories[0].items[0].name, 'renamed')
  })
})
