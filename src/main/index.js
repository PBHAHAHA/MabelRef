/**
 * [INPUT]: 依赖 electron 的 app/BrowserWindow/ipcMain/shell/dialog、mabelPackage、windowFocusMode 与 fs/path 管理桌面窗口、项目文件对话框、文件定位和系统事件
 * [OUTPUT]: 创建无边框主窗口并提供窗口控制/画布专注模式 IPC、文件定位 IPC 与 .mabel 项目文件保存/打开 IPC
 * [POS]: main 进程入口，负责应用生命周期、窗口壳与 renderer 加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { basename, dirname, extname, join } from 'path'
import { access, mkdir, readFile, rename, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createEmptyMabelProject, decodeMabelProject } from '../shared/mabelProject.mjs'
import {
  decodeMabelPackage,
  hasMabelPackageHeader,
  isMabelPackage,
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
  touchRecentProject
} from '../shared/mabelLibrary.mjs'
import { applyCanvasFocusMode, applyWindowPinMode } from './windowFocusMode.mjs'

const ensureMabelExtension = (name) =>
  name.toLowerCase().endsWith('.mabel') ? name : `${name}.mabel`

const getRenamedProjectPath = (filePath, name) => {
  const trimmed = String(name || '').trim()
  if (!filePath || !trimmed) return ''

  return join(dirname(filePath), ensureMabelExtension(basename(trimmed, extname(trimmed))))
}

const pathExists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
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

async function updateMabelLibrary(updater) {
  return writeMabelLibrary(updater(await readMabelLibrary()))
}

function registerWindowControls(window) {
  let isPinned = false

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
  ipcMain.handle('window:toggle-pin', () => {
    isPinned = !isPinned
    applyWindowPinMode(window, isPinned)
    return isPinned
  })
}

async function readMabelProjectFile(filePath) {
    const content = await readFile(filePath)

    if (isMabelPackage(content)) {
      return decodeMabelPackage(content)
    } else if (hasMabelPackageHeader(content)) {
      throw new Error('这个 .mabel 项目包不完整或已损坏，请尝试打开备份文件')
    }

    return decodeMabelProject(content.toString('utf8'))
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
    await updateMabelLibrary((library) =>
      touchRecentProject(library, filePath, basename(filePath, '.mabel'))
    )

    return {
      canceled: false,
      filePath,
      name: basename(filePath, '.mabel'),
      project: await readMabelProjectFile(filePath)
    }
  })

  ipcMain.handle('project:open-path', async (_, filePath) => {
    if (!filePath) return { canceled: true }

    await updateMabelLibrary((library) =>
      touchRecentProject(library, filePath, basename(filePath, '.mabel'))
    )

    return {
      canceled: false,
      filePath,
      name: basename(filePath, '.mabel'),
      project: await readMabelProjectFile(filePath)
    }
  })

  ipcMain.handle('project:save', async (event, { filePath, project, requestId }) => {
    let targetPath = filePath

    if (!targetPath) {
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

    targetPath = ensureMabelExtension(targetPath)
    await mkdir(dirname(targetPath), { recursive: true })

    const sendProgress = (progress) => {
      if (!requestId) return
      event.sender.send(`project:save-progress:${requestId}`, progress)
    }

    await writeMabelPackage(targetPath, project, sendProgress)
    await updateMabelLibrary((library) =>
      touchRecentProject(library, targetPath, basename(targetPath, '.mabel'))
    )

    return {
      canceled: false,
      filePath: targetPath,
      name: basename(targetPath, '.mabel')
    }
  })
}

function registerMabelLibrary() {
  ipcMain.handle('library:get', () => readMabelLibrary())
  ipcMain.handle('library:add-category', (_, name) =>
    updateMabelLibrary((library) => addCategory(library, name))
  )
  ipcMain.handle('library:rename-category', (_, { categoryId, name }) =>
    updateMabelLibrary((library) => renameCategory(library, categoryId, name))
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
    const library = await updateMabelLibrary((currentLibrary) =>
      renameProject(currentLibrary, filePath, nextFilePath, projectName)
    )

    return {
      library,
      project: { filePath: nextFilePath, name: projectName }
    }
  })
  ipcMain.handle('library:remove-category', (_, categoryId) =>
    updateMabelLibrary((library) => removeCategory(library, categoryId))
  )
  ipcMain.handle('library:add-project-to-category', (_, { categoryId, filePath, name }) =>
    updateMabelLibrary((library) => addProjectToCategory(library, categoryId, filePath, name))
  )
  ipcMain.handle('library:remove-project-from-category', (_, { categoryId, filePath }) =>
    updateMabelLibrary((library) => removeProjectFromCategory(library, categoryId, filePath))
  )
  ipcMain.handle('library:touch-recent-project', (_, { filePath, name }) =>
    updateMabelLibrary((library) => touchRecentProject(library, filePath, name))
  )
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
  registerWindowControls(mainWindow)
  registerProjectFiles(mainWindow)
  registerMabelLibrary()
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
