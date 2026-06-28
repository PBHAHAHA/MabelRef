/**
 * [INPUT]: 依赖 electron contextBridge/ipcRenderer/webUtils 与 electron-toolkit preload 安全桥
 * [OUTPUT]: 向 renderer 暴露 electron 基础能力、windowControls 窗口控制 API、projects 项目文件 API 与 files 文件路径/定位 API
 * [POS]: preload 安全边界，连接主进程 IPC 与 Vue 渲染层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },
  projects: {
    save: (project) => ipcRenderer.invoke('project:save', project),
    open: () => ipcRenderer.invoke('project:open')
  },
  files: {
    getPath: (file) => webUtils.getPathForFile(file),
    showInFolder: (filePath) => ipcRenderer.invoke('file:show-in-folder', filePath)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
