import { contextBridge, ipcRenderer } from 'electron'

/** 最近文件条目 */
export interface RecentFile {
  path: string
  fileName: string
  size: number
  openedAt: number
}

/** glTF 外部资源包（主进程打包，渲染进程解包） */
export interface GltfPackage {
  gltfJson: Record<string, unknown>
  resources: Record<string, ArrayBuffer>
}

/** GLB 文件加载结果 */
export interface GlbLoadResult {
  type: 'glb'
  buffer: ArrayBuffer
  fileName: string
  size: number
}

/** glTF 文件加载结果（含外部资源） */
export interface GltfLoadResult {
  type: 'gltf'
  gltfPackage: GltfPackage
  fileName: string
  size: number
}

export type FileLoadResult = GlbLoadResult | GltfLoadResult | null

// 通过 contextBridge 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 打开文件对话框，选择 GLB/GLTF 文件
   * @returns 文件信息（GLB 返回 buffer；glTF 返回 gltfPackage）
   */
  openFile: () => ipcRenderer.invoke('dialog:openGlb') as Promise<FileLoadResult>,

  /**
   * 监听文件拖拽事件
   */
  onFileDropped: (callback: (data: { buffer: ArrayBuffer; fileName: string; size: number }) => void) => {
    ipcRenderer.on('file:dropped', (_event, data) => callback(data))
  },

  /** 获取最近文件列表 */
  getRecentFiles: () => ipcRenderer.invoke('recent:get') as Promise<RecentFile[]>,

  /** 从最近文件路径打开（返回文件数据，失败返回 null） */
  openRecentFile: (filePath: string) =>
    ipcRenderer.invoke('recent:open', filePath) as Promise<FileLoadResult>,

  /** 清空最近文件列表 */
  clearRecentFiles: () => ipcRenderer.invoke('recent:clear'),

  /** 保存 GLB 到当前文件（无当前文件时返回 no-file） */
  saveFile: (data: ArrayBuffer) =>
    ipcRenderer.invoke('file:save', data) as Promise<
      { status: 'ok'; path: string } | { status: 'no-file' } | { status: 'error'; message: string }
    >,

  /** 另存为：弹出保存对话框选择路径 */
  saveFileAs: (data: ArrayBuffer) =>
    ipcRenderer.invoke('file:saveAs', data) as Promise<
      { status: 'ok'; path: string } | { status: 'canceled' } | { status: 'error'; message: string }
    >,
})

// 类型声明
export interface ElectronAPI {
  openFile: () => Promise<FileLoadResult>
  onFileDropped: (callback: (data: { buffer: ArrayBuffer; fileName: string; size: number }) => void) => void
  getRecentFiles: () => Promise<RecentFile[]>
  openRecentFile: (filePath: string) => Promise<FileLoadResult>
  clearRecentFiles: () => Promise<void>
  saveFile: (data: ArrayBuffer) => Promise<
    { status: 'ok'; path: string } | { status: 'no-file' } | { status: 'error'; message: string }
  >
  saveFileAs: (data: ArrayBuffer) => Promise<
    { status: 'ok'; path: string } | { status: 'canceled' } | { status: 'error'; message: string }
  >
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}