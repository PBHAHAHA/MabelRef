/**
 * [INPUT]: 依赖 electron 的 app/BrowserWindow/ipcMain/shell/dialog、mabelPackage、windowFocusMode、resources/logo.png 与 fs/path 管理桌面窗口、工作空间、项目文件对话框、文件定位和系统事件
 * [OUTPUT]: 创建无边框主窗口并提供窗口控制/画布专注模式 IPC、工作空间分类文件夹、文件定位 IPC、.mabel 项目文件保存/打开 IPC 与 Ctrl+Alt+B 引擎压测窗口
 * [POS]: main 进程入口，负责应用生命周期、窗口壳与 renderer 加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { app, shell, BrowserWindow, ipcMain, Menu, dialog, screen } from 'electron'
import { basename, dirname, extname, join } from 'path'
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo.png?asset'
import { createEmptyMabelProject, decodeMabelProject } from '../shared/mabelProject.mjs'
import {
  decodeMabelPackage,
  decodeMabelPackageManifestFile,
  hasMabelPackageHeader,
  isMabelPackage,
  readMabelPackageAssetFile,
  writeMabelPackage
} from '../shared/mabelPackage.mjs'
import {
  addCategory,
  addProjectToCategory,
  createEmptyLibrary,
  normalizeLibrary,
  removeCategory,
  removeProjectFromCategory,
  renameCategory,
  renameProject,
  setCategoryFolderPath
} from '../shared/mabelLibrary.mjs'
import { applyCanvasFocusMode, applyWindowPinMode } from './windowFocusMode.mjs'

const ensureMabelExtension = (name) =>
  name.toLowerCase().endsWith('.mabel') ? name : `${name}.mabel`

const getRenamedProjectPath = (filePath, name) => {
  const trimmed = String(name || '').trim()
  if (!filePath || !trimmed) return ''

  return join(dirname(filePath), ensureMabelExtension(basename(trimmed, extname(trimmed))))
}

const sanitizePathName = (name, fallback = '未命名') => {
  const normalized = String(name || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()

  return normalized || fallback
}

const getAvailableFilePath = async (directory, fileName) => {
  const extension = extname(fileName)
  const baseName = basename(fileName, extension)
  let candidate = join(directory, fileName)
  let index = 1

  while (await pathExists(candidate)) {
    candidate = join(directory, `${baseName}-${index}${extension}`)
    index += 1
  }

  return candidate
}

const getWorkspaceCategoryPath = (library, categoryName) => {
  if (!library.workspacePath) return ''
  return join(library.workspacePath, sanitizePathName(categoryName, '未命名分类'))
}

const createCategoryIdFromPath = (folderPath) => `cat-${Buffer.from(folderPath).toString('hex')}`

const getMabelProjectItem = (filePath) => ({
  path: filePath,
  name: basename(filePath, '.mabel'),
  lastOpenedAt: 0
})

async function scanWorkspaceLibrary(workspacePath) {
  await mkdir(workspacePath, { recursive: true })

  const entries = await readdir(workspacePath, { withFileTypes: true })
  const rootProjects = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mabel'))
    .map((entry) => getMabelProjectItem(join(workspacePath, entry.name)))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
  const categories = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    const folderPath = join(workspacePath, entry.name)
    const files = await readdir(folderPath, { withFileTypes: true })
    const items = files
      .filter((file) => file.isFile() && file.name.toLowerCase().endsWith('.mabel'))
      .map((file) => getMabelProjectItem(join(folderPath, file.name)))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))

    categories.push({
      id: createCategoryIdFromPath(folderPath),
      name: entry.name,
      folderPath,
      items
    })
  }

  return {
    version: 1,
    workspacePath,
    rootProjects,
    categories: categories.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
  }
}

const pathExists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const getImageFileNameFromUrl = (imageUrl, mime) => {
  const extension = {
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp'
  }[mime]

  try {
    const name = basename(decodeURIComponent(new URL(imageUrl).pathname))
    if (name && extname(name)) return name
  } catch {
    // Keep the fallback name below.
  }

  return `dropped-image.${extension || 'png'}`
}

const getImageExtensionFromMime = (mime) =>
  ({
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp'
  })[mime] || 'png'

const getSafeImageFileName = (name, mime) => {
  const safeName = sanitizePathName(name || 'image', 'image')
  return extname(safeName) ? safeName : `${safeName}.${getImageExtensionFromMime(mime)}`
}

const getLibraryPath = () => join(app.getPath('userData'), 'mabel-library.json')

async function readMabelLibrary() {
  try {
    return normalizeLibrary(JSON.parse(await readFile(getLibraryPath(), 'utf8')))
  } catch {
    return createEmptyLibrary()
  }
}

async function writeMabelLibrary(library) {
  const normalized = normalizeLibrary(library)
  await mkdir(dirname(getLibraryPath()), { recursive: true })
  await writeFile(getLibraryPath(), JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
}

async function readSyncedMabelLibrary() {
  const library = await readMabelLibrary()
  if (!library.workspacePath) return library
  if (!(await pathExists(library.workspacePath))) return library

  return writeMabelLibrary(await scanWorkspaceLibrary(library.workspacePath))
}

async function updateMabelLibrary(updater) {
  return writeMabelLibrary(await updater(await readMabelLibrary()))
}

function registerWindowControls(window) {
  let isPinned = false
  let canvasWindowDrag = null
  let canvasWindowDragTimer = null
  let closeConfirmed = false
  let closePromptOpen = false

  const endCanvasWindowDrag = () => {
    if (canvasWindowDragTimer) clearInterval(canvasWindowDragTimer)
    canvasWindowDragTimer = null
    canvasWindowDrag = null
  }

  ipcMain.handle('window:minimize', () => window.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (window.isMaximized()) {
      window.unmaximize()
      return false
    }

    window.maximize()
    return true
  })
  ipcMain.handle('window:close', () => window.close())
  ipcMain.on('window:close-response', (_, allowClose) => {
    closePromptOpen = false
    if (!allowClose || window.isDestroyed()) return

    closeConfirmed = true
    window.close()
  })
  ipcMain.handle('window:set-canvas-focus-mode', (_, enabled) => {
    applyCanvasFocusMode(window, Boolean(enabled))
    return Boolean(enabled)
  })
  ipcMain.handle('window:toggle-pin', () => {
    isPinned = !isPinned
    applyWindowPinMode(window, isPinned)
    return isPinned
  })
  ipcMain.handle('window:begin-canvas-drag', () => {
    if (window.isMaximized() || window.isFullScreen()) return false

    endCanvasWindowDrag()
    const point = screen.getCursorScreenPoint()
    canvasWindowDrag = {
      bounds: window.getBounds(),
      point
    }
    canvasWindowDragTimer = setInterval(() => {
      if (!canvasWindowDrag || window.isDestroyed()) {
        endCanvasWindowDrag()
        return
      }

      const cursor = screen.getCursorScreenPoint()
      window.setPosition(
        Math.round(canvasWindowDrag.bounds.x + cursor.x - canvasWindowDrag.point.x),
        Math.round(canvasWindowDrag.bounds.y + cursor.y - canvasWindowDrag.point.y)
      )
    }, 8)
    return true
  })
  ipcMain.on('window:end-canvas-drag', () => {
    endCanvasWindowDrag()
  })
  window.on('close', (event) => {
    if (closeConfirmed) return

    event.preventDefault()
    if (closePromptOpen) return

    closePromptOpen = true
    window.webContents.send('window:close-request')
  })
  window.on('blur', endCanvasWindowDrag)
  window.on('closed', endCanvasWindowDrag)
}

async function readMabelProjectFile(filePath) {
    const content = await readFile(filePath)

    if (isMabelPackage(content)) {
      return {
        project: await decodeMabelPackageManifestFile(filePath),
        packagePath: filePath
      }
    } else if (hasMabelPackageHeader(content)) {
      throw new Error('这个 .mabel 项目包不完整或已损坏，请尝试打开备份文件')
    }

    return {
      project: decodeMabelProject(content.toString('utf8')),
      packagePath: ''
    }
}

function registerProjectFiles(window) {
  ipcMain.handle('project:new', async () => ({ project: createEmptyMabelProject() }))

  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '打开 MabelRef 项目',
      filters: [{ name: 'MabelRef Project', extensions: ['mabel'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const opened = await readMabelProjectFile(filePath)
    return {
      canceled: false,
      filePath,
      name: basename(filePath, '.mabel'),
      ...opened
    }
  })

  ipcMain.handle('project:open-path', async (_, filePath) => {
    if (!filePath) return { canceled: true }

    const opened = await readMabelProjectFile(filePath)
    return {
      canceled: false,
      filePath,
      name: basename(filePath, '.mabel'),
      ...opened
    }
  })

  ipcMain.handle('project:read-asset', async (_, { packagePath, assetPath }) => ({
    bytes: await readMabelPackageAssetFile(packagePath, assetPath)
  }))

  ipcMain.handle('project:save', async (event, { filePath, project, requestId, categoryId, fileName }) => {
    let targetPath = filePath
    let previousPath = ''
    const library = await readMabelLibrary()
    const category = library.categories.find((item) => item.id === categoryId)

    if (category?.folderPath) {
      await mkdir(category.folderPath, { recursive: true })
      const currentName = basename(filePath || sanitizePathName(fileName, '未命名'))
      targetPath = join(category.folderPath, ensureMabelExtension(currentName))
      if (filePath && dirname(filePath) !== category.folderPath) {
        previousPath = filePath
      }
    } else if (!targetPath) {

      if (library.workspacePath) {
        targetPath = join(
          library.workspacePath,
          ensureMabelExtension(sanitizePathName(fileName, '未命名'))
        )
      } else {
        const result = await dialog.showSaveDialog(window, {
          title: '保存 MabelRef 项目',
          defaultPath: join(app.getPath('documents'), '未命名.mabel'),
          filters: [{ name: 'MabelRef Project', extensions: ['mabel'] }]
        })

        if (result.canceled || !result.filePath) {
          return { canceled: true }
        }

        targetPath = result.filePath
      }
    }

    targetPath = ensureMabelExtension(targetPath)
    if (targetPath !== filePath && (await pathExists(targetPath))) {
      targetPath = await getAvailableFilePath(dirname(targetPath), basename(targetPath))
    }
    await mkdir(dirname(targetPath), { recursive: true })

    const sendProgress = (progress) => {
      if (!requestId) return
      event.sender.send(`project:save-progress:${requestId}`, progress)
    }

    await writeMabelPackage(targetPath, project, sendProgress)
    if (previousPath && previousPath !== targetPath && (await pathExists(previousPath))) {
      await rm(previousPath)
    }
    const savedLibrary = await readMabelLibrary()
    if (savedLibrary.workspacePath) {
      await writeMabelLibrary(await scanWorkspaceLibrary(savedLibrary.workspacePath))
    }

    return {
      canceled: false,
      filePath: targetPath,
      name: basename(targetPath, '.mabel')
    }
  })
}

function registerMabelLibrary() {
  ipcMain.handle('library:get', () => readSyncedMabelLibrary())
  ipcMain.handle('library:set-workspace', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 MabelRef 工作空间',
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return readMabelLibrary()
    }

    return writeMabelLibrary(await scanWorkspaceLibrary(result.filePaths[0]))
  })
  ipcMain.handle('library:add-category', async (_, name) =>
    updateMabelLibrary(async (library) => {
      let nextLibrary = addCategory(library, name)
      const category = nextLibrary.categories.at(-1)

      if (category && nextLibrary.workspacePath) {
        const folderPath = getWorkspaceCategoryPath(nextLibrary, category.name)
        await mkdir(folderPath, { recursive: true })
        nextLibrary = setCategoryFolderPath(nextLibrary, category.id, folderPath)
      }

      return nextLibrary
    }).then((library) => (library.workspacePath ? readSyncedMabelLibrary() : library))
  )
  ipcMain.handle('library:rename-category', async (_, { categoryId, name }) =>
    updateMabelLibrary(async (library) => {
      let nextLibrary = renameCategory(library, categoryId, name)
      const category = nextLibrary.categories.find((item) => item.id === categoryId)

      if (category && nextLibrary.workspacePath) {
        const folderPath = getWorkspaceCategoryPath(nextLibrary, category.name)
        await mkdir(folderPath, { recursive: true })
        nextLibrary = setCategoryFolderPath(nextLibrary, categoryId, folderPath)
      }

      return nextLibrary
    }).then((library) => (library.workspacePath ? readSyncedMabelLibrary() : library))
  )
  ipcMain.handle('library:rename-project', async (_, { filePath, name }) => {
    const nextFilePath = getRenamedProjectPath(filePath, name)
    if (!nextFilePath || nextFilePath === filePath) {
      return {
        library: await readMabelLibrary(),
        project: { filePath, name: basename(filePath, '.mabel') }
      }
    }

    if (!(await pathExists(filePath))) {
      throw new Error('找不到原文件，请先确认这个项目文件还在原位置')
    }
    if (await pathExists(nextFilePath)) {
      throw new Error('同名文件已经存在，请换一个名字')
    }

    await rename(filePath, nextFilePath)
    const projectName = basename(nextFilePath, '.mabel')
    await updateMabelLibrary((currentLibrary) =>
      renameProject(currentLibrary, filePath, nextFilePath, projectName)
    )
    const library = await readSyncedMabelLibrary()

    return {
      library,
      project: { filePath: nextFilePath, name: projectName }
    }
  })
  ipcMain.handle('library:remove-category', (_, categoryId) =>
    updateMabelLibrary((library) => removeCategory(library, categoryId))
  )
  ipcMain.handle('library:add-project-to-category', async (_, { categoryId, filePath, name }) => {
    if (!filePath) return { library: await readMabelLibrary(), project: null }

    return updateMabelLibrary(async (library) => {
      const normalized = normalizeLibrary(library)
      const category = normalized.categories.find((item) => item.id === categoryId)
      let nextFilePath = filePath
      let projectName = name || basename(filePath, '.mabel')

      if (category?.folderPath) {
        if (!(await pathExists(filePath))) {
          throw new Error('找不到原文件，请先确认这个项目文件还在原位置')
        }

        await mkdir(category.folderPath, { recursive: true })
        const targetDirectory = category.folderPath
        const currentDirectory = dirname(filePath)
        const targetName = ensureMabelExtension(basename(filePath))

        if (currentDirectory !== targetDirectory) {
          nextFilePath = await getAvailableFilePath(targetDirectory, targetName)
          await rename(filePath, nextFilePath)
          projectName = basename(nextFilePath, '.mabel')
        }
      }

      const renamedLibrary =
        nextFilePath === filePath
          ? normalized
          : renameProject(normalized, filePath, nextFilePath, projectName)

      return addProjectToCategory(renamedLibrary, categoryId, nextFilePath, projectName)
    }).then(async (library) => {
      const syncedLibrary = library.workspacePath ? await readSyncedMabelLibrary() : library
      const project = library.categories.find((category) => category.id === categoryId)?.items[0]

      return {
        library: syncedLibrary,
        project: project
          ? {
              filePath: project.path,
              name: project.name
            }
          : null
      }
    })
  })
  ipcMain.handle('library:remove-project-from-category', (_, { categoryId, filePath }) =>
    updateMabelLibrary((library) => removeProjectFromCategory(library, categoryId, filePath))
  )
}

function registerFileActions(window) {
  ipcMain.handle('file:show-in-folder', (_, filePath) => {
    if (!filePath) return false

    shell.showItemInFolder(filePath)
    return true
  })

  ipcMain.handle('file:save-image-as', async (_, image) => {
    if (!image?.bytes?.length) {
      throw new Error('找不到可保存的图片数据')
    }

    const mime = String(image.mime || 'image/png')
    const defaultName = getSafeImageFileName(image.name, mime)
    const result = await dialog.showSaveDialog(window, {
      title: '图片另存为',
      defaultPath: join(app.getPath('pictures'), defaultName),
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await writeFile(result.filePath, Buffer.from(image.bytes))
    return {
      canceled: false,
      filePath: result.filePath
    }
  })

  ipcMain.handle('file:fetch-image-url', async (_, imageUrl) => {
    const url = new URL(String(imageUrl || ''))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('只支持从 http 或 https 图片地址导入')
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`图片下载失败：${response.status}`)
    }

    const mime = (response.headers.get('content-type') || '').split(';')[0].trim()
    if (!mime.startsWith('image/')) {
      throw new Error('拖入的地址不是图片')
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    return {
      bytes: [...bytes],
      mime,
      name: getImageFileNameFromUrl(url.toString(), mime)
    }
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getMediaGenerateEndpoint = (endpoint) => {
  const normalized = String(endpoint || '').trim().replace(/\/+$/, '')

  if (!normalized) return ''
  if (normalized.endsWith('/v1/images/edits')) {
    return `${normalized.slice(0, -'/v1/images/edits'.length)}/v1/media/generate`
  }
  if (normalized.endsWith('/v1/images/generations')) {
    return `${normalized.slice(0, -'/v1/images/generations'.length)}/v1/media/generate`
  }
  if (normalized.endsWith('/v1/media/generate')) return normalized
  if (normalized.endsWith('/v1')) return `${normalized}/media/generate`
  return `${normalized}/v1/media/generate`
}

const getMediaStatusEndpoint = (generateEndpoint, taskId) => {
  const url = new URL(generateEndpoint)
  url.pathname = url.pathname.replace(/\/media\/generate$/, '/media/status')
  url.searchParams.set('task_id', taskId)
  return url.toString()
}

const parseDataUrlImage = (value) => {
  const match = String(value || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null

  return {
    bytes: [...Buffer.from(match[2], 'base64')],
    mime: match[1]
  }
}

const parseBase64Image = (value, mime = 'image/png') => {
  if (!value) return null

  return {
    bytes: [...Buffer.from(value, 'base64')],
    mime
  }
}

const parseImageEditResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.startsWith('image/')) {
    return {
      bytes: [...Buffer.from(await response.arrayBuffer())],
      mime: contentType.split(';')[0]
    }
  }

  const body = await response.json()
  const firstImage =
    body?.data?.[0] ||
    body?.images?.[0] ||
    body?.output?.find?.((item) => item?.b64_json || item?.image || item?.url) ||
    body
  const b64Json = firstImage?.b64_json || firstImage?.image || firstImage?.base64 || body?.image
  const dataUrlImage = parseDataUrlImage(b64Json)
  if (dataUrlImage) return dataUrlImage

  const base64Image = parseBase64Image(b64Json, firstImage?.mime || body?.mime || 'image/png')
  if (base64Image) return base64Image

  const imageUrl = firstImage?.url || body?.url
  if (imageUrl) {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`AI 返回图片下载失败：${imageResponse.status}`)
    }

    return {
      bytes: [...Buffer.from(await imageResponse.arrayBuffer())],
      mime: (imageResponse.headers.get('content-type') || 'image/png').split(';')[0]
    }
  }

  throw new Error('AI 服务没有返回可用图片')
}

const downloadImageFromUrl = async (imageUrl) => {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`AI 返回图片下载失败：${imageResponse.status}`)
  }

  return {
    bytes: [...Buffer.from(await imageResponse.arrayBuffer())],
    mime: (imageResponse.headers.get('content-type') || 'image/png').split(';')[0]
  }
}

const pollMediaTask = async ({ endpoint, taskId, headers }) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(attempt === 0 ? 1200 : 3000)

    const response = await fetch(getMediaStatusEndpoint(endpoint, taskId), { headers })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(errorText || `AI 任务查询失败：${response.status}`)
    }

    const status = await response.json()
    if (!status.is_final) continue
    if (status.state === 'failed') throw new Error(status.error || 'AI 任务失败')
    if (status.state !== 'success') throw new Error(status.error || `AI 任务状态异常：${status.state}`)
    if (!status.result_url) throw new Error('AI 任务完成但没有返回图片地址')

    return downloadImageFromUrl(status.result_url)
  }

  throw new Error('AI 任务超时，请稍后重试')
}

function registerAiActions() {
  ipcMain.handle('ai:edit-image', async (_, { settings, image, prompt }) => {
    const endpoint = getMediaGenerateEndpoint(settings?.endpoint || 'https://api.lk888.ai')
    const model = String(settings?.model || 'gpt-image-2').trim()
    const apiKey = String(settings?.apiKey || '').trim()
    const editPrompt = String(prompt || '').trim()

    if (!endpoint) throw new Error('请先在设置里填写 AI 服务地址')
    if (!model) throw new Error('请先在设置里填写模型')
    if (!editPrompt) throw new Error('请输入图片修改要求')
    if (!image?.bytes?.length) throw new Error('找不到要修改的图片数据')

    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    }
    const imageDataUrl = `data:${image.mime || 'image/png'};base64,${Buffer.from(image.bytes).toString('base64')}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        prompt: editPrompt,
        params: {
          images: [imageDataUrl],
          n: 1,
          quality: settings?.quality || 'auto',
          response_format: 'url',
          size: settings?.size || 'auto'
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(errorText || `AI 修改失败：${response.status}`)
    }

    const result = await response.clone().json().catch(() => null)
    const directImage = result?.data?.[0]?.url || result?.result_url || result?.url
    if (directImage) return downloadImageFromUrl(directImage)
    if (result?.task_id) return pollMediaTask({ endpoint, taskId: result.task_id, headers })

    return parseImageEditResponse(response)
  })
}

function createBenchWindow() {
  const benchWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#14161b',
    autoHideMenuBar: true,
    title: 'MabelRef Engine Bench'
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    benchWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/bench.html`)
  } else {
    benchWindow.loadFile(join(__dirname, '../renderer/bench.html'))
  }
}

function registerBenchShortcut(window) {
  window.webContents.on('before-input-event', (_, input) => {
    const hasModifier = input.control || input.meta

    if (input.type === 'keyDown' && hasModifier && input.alt && input.code === 'KeyB') {
      createBenchWindow()
    }
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    backgroundColor: '#111419',
    roundedCorners: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  Menu.setApplicationMenu(null)
  registerBenchShortcut(mainWindow)
  registerWindowControls(mainWindow)
  registerProjectFiles(mainWindow)
  registerMabelLibrary()
  registerFileActions(mainWindow)
  registerAiActions()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('app.mabelref.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
