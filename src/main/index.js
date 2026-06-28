/**
 * [INPUT]: 依赖 electron 的 app/BrowserWindow/ipcMain/shell/dialog、mabelPackage、windowFocusMode 与 fs/path 管理桌面窗口、项目库、文件对话框、文件定位和系统事件
 * [OUTPUT]: 创建无边框主窗口并提供窗口控制/画布专注模式 IPC、工作区 IPC、工作区内项目库 IPC、空画布创建、文件定位 IPC 与 .mabel 包保存/打开 IPC
 * [POS]: main 进程入口，负责应用生命周期、窗口壳与 renderer 加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { basename, dirname, join } from 'path'
import { access, mkdir, readdir, readFile, rename, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createEmptyMabelProject, decodeMabelProject } from '../shared/mabelProject.mjs'
import {
  decodeMabelPackage,
  encodeMabelPackage,
  hasMabelPackageHeader,
  isMabelPackage
} from '../shared/mabelPackage.mjs'
import {
  createWorkspaceManifest,
  createRenamedMabelPath,
  isPathInside,
  MABEL_WORKSPACE_FILE,
  normalizeWorkspaceTree,
  sanitizeWorkspaceName
} from '../shared/mabelWorkspace.mjs'
import { applyCanvasFocusMode } from './windowFocusMode.mjs'

const getWorkspaceStatePath = () => join(app.getPath('userData'), 'workspace.json')
const ensureMabelExtension = (name) =>
  name.toLowerCase().endsWith('.mabel') ? name : `${name}.mabel`
const sanitizeName = sanitizeWorkspaceName

async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function writeJson(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

async function readWorkspaceState() {
  try {
    const state = JSON.parse(await readFile(getWorkspaceStatePath(), 'utf8'))
    if (!state.rootPath || !(await pathExists(state.rootPath))) return null

    await ensureWorkspace(state.rootPath)
    return state.rootPath
  } catch {
    return null
  }
}

async function saveWorkspaceState(rootPath) {
  await writeJson(getWorkspaceStatePath(), { rootPath })
}

async function ensureWorkspace(rootPath) {
  await mkdir(rootPath, { recursive: true })

  const manifestPath = join(rootPath, MABEL_WORKSPACE_FILE)
  if (await pathExists(manifestPath)) return

  await writeJson(
    manifestPath,
    createWorkspaceManifest({
      name: basename(rootPath)
    })
  )
}

async function getActiveWorkspacePath() {
  const rootPath = await readWorkspaceState()
  if (!rootPath) throw new Error('Workspace is not selected')

  return rootPath
}

async function assertInsideActiveWorkspace(targetPath) {
  const rootPath = await getActiveWorkspacePath()
  if (!isPathInside(rootPath, targetPath)) {
    throw new Error('Target path is outside the active workspace')
  }

  return rootPath
}

async function createAvailableProjectPath(categoryPath, projectName) {
  const safeName = sanitizeName(projectName || 'Untitled') || 'Untitled'
  const baseName = safeName.replace(/\.mabel$/i, '')
  let filePath = join(categoryPath, ensureMabelExtension(baseName))
  let index = 2

  while (await pathExists(filePath)) {
    filePath = join(categoryPath, `${baseName} ${index}.mabel`)
    index += 1
  }

  return filePath
}

async function scanWorkspace(rootPath) {
  await ensureWorkspace(rootPath)

  const directories = await readdir(rootPath, { withFileTypes: true })
  const entries = []

  for (const directory of directories.filter((entry) => entry.isDirectory())) {
    const categoryPath = join(rootPath, directory.name)
    const files = await readdir(categoryPath, { withFileTypes: true })
    entries.push({
      name: directory.name,
      path: categoryPath,
      files: files
        .filter((entry) => entry.isFile())
        .map((entry) => ({
          name: entry.name,
          path: join(categoryPath, entry.name)
        }))
    })
  }

  return normalizeWorkspaceTree({ rootPath, entries })
}

async function scanActiveWorkspace() {
  return scanWorkspace(await getActiveWorkspacePath())
}

async function activateWorkspace(rootPath) {
  await ensureWorkspace(rootPath)
  await saveWorkspaceState(rootPath)
  return scanWorkspace(rootPath)
}

function registerWindowControls(window) {
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
  ipcMain.handle('window:set-canvas-focus-mode', (_, enabled) => {
    applyCanvasFocusMode(window, Boolean(enabled))
    return Boolean(enabled)
  })
}

function registerWorkspaceFiles(window) {
  ipcMain.handle('workspace:get-current', async () => {
    const rootPath = await readWorkspaceState()
    if (!rootPath) return { workspace: null }

    return { workspace: await scanWorkspace(rootPath) }
  })

  ipcMain.handle('workspace:choose', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '选择 Mabel 工作区',
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    return {
      canceled: false,
      workspace: await activateWorkspace(result.filePaths[0])
    }
  })

  ipcMain.handle('workspace:create', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '创建 Mabel 工作区',
      defaultPath: join(app.getPath('documents'), 'Mabel Workspace'),
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    return {
      canceled: false,
      workspace: await activateWorkspace(result.filePaths[0])
    }
  })

  ipcMain.handle('workspace:scan', async () => ({ workspace: await scanActiveWorkspace() }))
}

function registerLibraryFiles() {
  ipcMain.handle('library:scan', async () => scanActiveWorkspace())

  ipcMain.handle('library:create-category', async (_, name) => {
    const categoryName = sanitizeName(name)
    if (!categoryName) throw new Error('Category name is required')

    await mkdir(join(await getActiveWorkspacePath(), categoryName), { recursive: true })
    return scanActiveWorkspace()
  })

  ipcMain.handle(
    'library:save-project',
    async (_, { filePath, categoryPath, projectName, project }) => {
      const targetPath = filePath
        ? filePath
        : join(categoryPath, ensureMabelExtension(sanitizeName(projectName || 'Untitled')))

      await assertInsideActiveWorkspace(targetPath)
      if (!targetPath.toLowerCase().endsWith('.mabel')) {
        throw new Error('Project path must end with .mabel')
      }

      await writeFile(targetPath, encodeMabelPackage(project))
      return { filePath: targetPath, library: await scanActiveWorkspace() }
    }
  )

  ipcMain.handle('library:create-canvas', async (_, { categoryPath, projectName }) => {
    await assertInsideActiveWorkspace(categoryPath)
    const project = createEmptyMabelProject()
    const filePath = await createAvailableProjectPath(categoryPath, projectName)

    await assertInsideActiveWorkspace(filePath)
    await writeFile(filePath, encodeMabelPackage(project))
    return {
      filePath,
      name: basename(filePath, '.mabel'),
      project,
      library: await scanActiveWorkspace()
    }
  })

  ipcMain.handle('library:open-project', async (_, filePath) => {
    await assertInsideActiveWorkspace(filePath)
    const content = await readFile(filePath)
    let project

    if (isMabelPackage(content)) {
      project = decodeMabelPackage(content)
    } else if (hasMabelPackageHeader(content)) {
      throw new Error('这个 .mabel 项目包不完整或已损坏，请尝试打开备份文件')
    } else {
      project = decodeMabelProject(content.toString('utf8'))
    }

    return {
      filePath,
      name: basename(filePath, '.mabel'),
      project
    }
  })

  ipcMain.handle('library:rename-project', async (_, { filePath, name }) => {
    await assertInsideActiveWorkspace(filePath)
    const nextFilePath = createRenamedMabelPath(filePath, name)

    await assertInsideActiveWorkspace(nextFilePath)
    if (nextFilePath === filePath) {
      return { filePath, library: await scanActiveWorkspace() }
    }

    if (await pathExists(nextFilePath)) {
      throw new Error('Project name already exists')
    }

    await rename(filePath, nextFilePath)
    return {
      filePath: nextFilePath,
      name: basename(nextFilePath, '.mabel'),
      library: await scanActiveWorkspace()
    }
  })
}

function registerFileActions() {
  ipcMain.handle('file:show-in-folder', (_, filePath) => {
    if (!filePath) return false

    shell.showItemInFolder(filePath)
    return true
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  Menu.setApplicationMenu(null)
  registerWindowControls(mainWindow)
  registerWorkspaceFiles(mainWindow)
  registerLibraryFiles()
  registerFileActions()

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
  electronApp.setAppUserModelId('com.electron')

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
