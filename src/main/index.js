/**
 * [INPUT]: 依赖 electron 的 app/BrowserWindow/ipcMain/shell/dialog 与 fs 管理桌面窗口、文件对话框、文件定位和系统事件
 * [OUTPUT]: 创建无边框主窗口并提供窗口控制 IPC、文件定位 IPC 与 .mabel 项目保存/打开 IPC
 * [POS]: main 进程入口，负责应用生命周期、窗口壳与 renderer 加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { decodeMabelProject, encodeMabelProject } from '../shared/mabelProject.mjs'

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
}

function registerProjectFiles(window) {
  ipcMain.handle('project:save', async (_, project) => {
    const result = await dialog.showSaveDialog(window, {
      title: '保存 Mabel 项目',
      defaultPath: 'Untitled.mabel',
      filters: [{ name: 'Mabel Project', extensions: ['mabel'] }]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await writeFile(result.filePath, encodeMabelProject(project), 'utf8')
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '打开 Mabel 项目',
      properties: ['openFile'],
      filters: [{ name: 'Mabel Project', extensions: ['mabel'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const content = await readFile(filePath, 'utf8')
    return { canceled: false, filePath, project: decodeMabelProject(content) }
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
  registerProjectFiles(mainWindow)
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
