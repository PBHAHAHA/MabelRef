/**
 * [INPUT]: 依赖普通 JSON 字符串与项目快照对象
 * [OUTPUT]: 对外提供旧版 JSON .mabel 编码/解码、空项目创建和 data/bytes 资源结构校验能力
 * [POS]: shared 的项目格式领域逻辑，被 main/renderer 共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const MABEL_PROJECT_MAGIC = 'MABEL_PROJECT'
export const MABEL_PROJECT_FORMAT_VERSION = 1

export function createEmptyMabelProject() {
  return {
    version: MABEL_PROJECT_FORMAT_VERSION,
    canvas: {
      zoom: 1,
      background: 'dot-grid'
    },
    assets: [],
    nodes: []
  }
}

const assertObject = (value, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
}

export function validateMabelProject(project) {
  assertObject(project, 'project')

  if (project.version !== MABEL_PROJECT_FORMAT_VERSION) {
    throw new Error(`Unsupported .mabel project version: ${project.version}`)
  }

  assertObject(project.canvas, 'project.canvas')

  if (!Array.isArray(project.assets)) {
    throw new Error('project.assets must be an array')
  }

  for (const asset of project.assets) {
    assertObject(asset, 'project.assets item')

    if (!asset.data && !asset.bytes) {
      throw new Error('project.assets item must include data or bytes')
    }
  }

  if (!Array.isArray(project.nodes)) {
    throw new Error('project.nodes must be an array')
  }

  return project
}

export function encodeMabelProject(project) {
  validateMabelProject(project)

  return JSON.stringify(
    {
      magic: MABEL_PROJECT_MAGIC,
      formatVersion: MABEL_PROJECT_FORMAT_VERSION,
      project
    },
    null,
    2
  )
}

export function decodeMabelProject(content) {
  const parsed = JSON.parse(content)
  assertObject(parsed, 'file')

  if (parsed.magic !== MABEL_PROJECT_MAGIC) {
    throw new Error('Invalid .mabel project file')
  }

  if (parsed.formatVersion !== MABEL_PROJECT_FORMAT_VERSION) {
    throw new Error(`Unsupported .mabel file version: ${parsed.formatVersion}`)
  }

  return validateMabelProject(parsed.project)
}
