import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, writeFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { packGltfResources } from './gltfPackager.js'

/** 文件读取结果（跨进程传输用纯 ArrayBuffer） */
interface FileReadResult {
  type: 'glb'
  buffer: ArrayBuffer
  fileName: string
  size: number
}

/** glTF 包读取结果（含外部资源） */
interface GltfReadResult {
  type: 'gltf'
  gltfJson: Record<string, unknown>
  resources: Record<string, ArrayBuffer>
  fileName: string
  size: number
}

type ReadResult = FileReadResult | GltfReadResult | null

async function readGlbFile(filePath: string): Promise<ReadResult> {
  try {
    const fileName = filePath.split(/[/\\]/).pop() || 'model.glb'

    // .gltf：读取外部资源打包返回
    if (filePath.toLowerCase().endsWith('.gltf')) {
      const pkg = await packGltfResources(filePath)
      const buf = await readFile(filePath)
      return {
        type: 'gltf',
        gltfJson: pkg.gltfJson,
        resources: pkg.resources,
        fileName,
        size: buf.byteLength,
      }
    }

    // .glb：直接返回二进制
    const buf = await readFile(filePath)
    // 转为纯 ArrayBuffer，避免 Node Buffer 的 SharedArrayBuffer 跨进程序列化问题
    const arrayBuffer = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    )
    return {
      type: 'glb',
      buffer: arrayBuffer,
      fileName,
      size: buf.byteLength,
    }
  } catch (error) {
    console.error('Failed to read file:', error)
    return null
  }
}

// vite-plugin-electron/simple 在 dev 时注入此变量
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// ESM 下用 import.meta.dirname 替代 __dirname
const dirname = import.meta.dirname

let mainWindow: BrowserWindow | null = null

// ---------- 最近文件管理 ----------

interface RecentFile {
  /** 绝对路径 */
  path: string
  /** 文件名（仅展示用） */
  fileName: string
  /** 文件大小（字节） */
  size: number
  /** 最后打开时间戳 */
  openedAt: number
}

const RECENT_FILES_MAX = 10
const RECENT_FILES_PATH = join(app.getPath('userData'), 'recent-files.json')

async function loadRecentFiles(): Promise<RecentFile[]> {
  try {
    if (!existsSync(RECENT_FILES_PATH)) return []
    const raw = await readFile(RECENT_FILES_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveRecentFiles(files: RecentFile[]): Promise<void> {
  await writeFile(RECENT_FILES_PATH, JSON.stringify(files, null, 2), 'utf-8')
}

async function addRecentFile(filePath: string, fileName: string, size: number): Promise<void> {
  const files = await loadRecentFiles()
  // 去重（按路径）
  const filtered = files.filter((f) => f.path !== filePath)
  filtered.unshift({ path: filePath, fileName, size, openedAt: Date.now() })
  await saveRecentFiles(filtered.slice(0, RECENT_FILES_MAX))
}

function createWindow() {
  // dev 模式窗口图标（打包版 exe 已内嵌图标，无需设置）
  const iconPath = join(dirname, '../build/icon.ico')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'GLB Viewer',
    backgroundColor: '#1a1a1a',
    show: false,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
  })

  if (VITE_DEV_SERVER_URL) {
    // 开发模式：加载 Vite 开发服务器
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(join(dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC 处理：打开文件对话框
ipcMain.handle('dialog:openGlb', async () => {
  if (!mainWindow) return null

  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'GLB / GLTF Models', extensions: ['glb', 'gltf'] }],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const filePath = result.filePaths[0]
  try {
    const fileName = filePath.split(/[/\\]/).pop() || 'model.glb'
    await addRecentFile(filePath, fileName, (await stat(filePath)).size)
    setCurrentFile(filePath)
    return await readGlbFile(filePath)
  } catch (error) {
    console.error('Failed to read file:', error)
    return null
  }
})

// IPC：获取最近文件列表
ipcMain.handle('recent:get', async () => {
  return await loadRecentFiles()
})

// IPC：从最近文件打开（读取文件并返回 ArrayBuffer）
ipcMain.handle('recent:open', async (_e, filePath: string) => {
  if (!existsSync(filePath)) return null
  const result = await readGlbFile(filePath)
  if (result) {
    await addRecentFile(filePath, result.fileName, result.size)
    setCurrentFile(filePath)
  }
  return result
})

// IPC：清空最近文件列表
ipcMain.handle('recent:clear', async () => {
  await saveRecentFiles([])
})

// ---------- 保存 / 另存为 ----------

/** 当前打开文件的绝对路径（保存=覆盖此文件） */
let currentFilePath: string | null = null

function setCurrentFile(filePath: string | null) {
  currentFilePath = filePath
}

// IPC：保存（覆盖当前文件；无当前文件时返回 'no-file' 让渲染进程转另存为）
ipcMain.handle('file:save', async (_e, data: ArrayBuffer) => {
  if (!currentFilePath) return { status: 'no-file' }
  try {
    const buf = Buffer.from(data)
    await writeFile(currentFilePath, buf)
    return { status: 'ok', path: currentFilePath }
  } catch (error) {
    console.error('Failed to save file:', error)
    return { status: 'error', message: String(error) }
  }
})

// IPC：另存为（弹出保存对话框）
ipcMain.handle('file:saveAs', async (_e, data: ArrayBuffer) => {
  if (!mainWindow) return { status: 'canceled' }

  const defaultName = currentFilePath
    ? currentFilePath.split(/[/\\]/).pop() || 'model.glb'
    : 'model.glb'

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'GLB Binary', extensions: ['glb'] }],
  })

  if (result.canceled || !result.filePath) return { status: 'canceled' }

  try {
    const buf = Buffer.from(data)
    await writeFile(result.filePath, buf)
    // 另存为成功后，当前文件切换为新路径（后续保存覆盖它）
    setCurrentFile(result.filePath)
    return { status: 'ok', path: result.filePath }
  } catch (error) {
    console.error('Failed to save file:', error)
    return { status: 'error', message: String(error) }
  }
})

// 应用就绪后创建窗口
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})