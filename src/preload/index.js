/**
 * [INPUT]: 依赖 electron contextBridge/ipcRenderer/webUtils 与 electron-toolkit preload 安全桥
 * [OUTPUT]: 向 renderer 暴露 electron 基础能力、窗口控制、项目文件、资料库与文件定位 API
 * [POS]: preload 安全边界，连接主进程 IPC 与 Vue 渲染层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    finishClose: (allowClose) => ipcRenderer.send('window:close-response', Boolean(allowClose)),
    onCloseRequest: (callback) => {
      const listener = () => callback()

      ipcRenderer.on('window:close-request', listener)
      return () => ipcRenderer.removeListener('window:close-request', listener)
    },
    setCanvasFocusMode: (enabled) => ipcRenderer.invoke('window:set-canvas-focus-mode', enabled),
    togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
    beginCanvasDrag: () => ipcRenderer.invoke('window:begin-canvas-drag'),
    endCanvasDrag: () => ipcRenderer.send('window:end-canvas-drag')
  },
  project: {
    new: () => ipcRenderer.invoke('project:new'),
    open: () => ipcRenderer.invoke('project:open'),
    openPath: (filePath) => ipcRenderer.invoke('project:open-path', filePath),
    save: (payload) => ipcRenderer.invoke('project:save', payload),
    onSaveProgress: (requestId, callback) => {
      const channel = `project:save-progress:${requestId}`
      const listener = (_, progress) => callback(progress)

      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  library: {
    get: () => ipcRenderer.invoke('library:get'),
    setWorkspace: () => ipcRenderer.invoke('library:set-workspace'),
    addCategory: (name) => ipcRenderer.invoke('library:add-category', name),
    renameCategory: (categoryId, name) =>
      ipcRenderer.invoke('library:rename-category', { categoryId, name }),
    renameProject: (filePath, name) =>
      ipcRenderer.invoke('library:rename-project', { filePath, name }),
    removeCategory: (categoryId) => ipcRenderer.invoke('library:remove-category', categoryId),
    addProjectToCategory: (categoryId, project) =>
      ipcRenderer.invoke('library:add-project-to-category', { categoryId, ...project }),
    removeProjectFromCategory: (categoryId, filePath) =>
      ipcRenderer.invoke('library:remove-project-from-category', { categoryId, filePath })
  },
  files: {
    getPath: (file) => webUtils.getPathForFile(file),
    showInFolder: (filePath) => ipcRenderer.invoke('file:show-in-folder', filePath)
  },
  ai: {
    editImage: (payload) => ipcRenderer.invoke('ai:edit-image', payload)
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
