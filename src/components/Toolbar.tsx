import { useViewerStore, type RenderMode, type BackgroundPreset, BACKGROUND_COLORS } from '@/store/viewerStore'
import { downloadScreenshot } from '@/utils/capture'
import { exportSceneToGLB } from '@/three/sceneRegistry'
import { EXAMPLE_MODELS } from '@/three/exampleModels'
import { useState, useEffect, useRef } from 'react'
import './Toolbar.css'

const RENDER_MODES: { value: RenderMode; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'wireframe', label: '线框' },
  { value: 'normals', label: '法线' },
  { value: 'uv', label: 'UV' },
]

const BG_OPTIONS: { value: BackgroundPreset; label: string }[] = [
  { value: 'dark', label: '深灰' },
  { value: 'black', label: '黑色' },
  { value: 'white', label: '白色' },
  { value: 'gray', label: '灰色' },
]

interface RecentFileItem {
  path: string
  fileName: string
  size: number
  openedAt: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type MenuKey = 'file' | 'actions' | 'display' | 'examples' | null

export function Toolbar() {
  const {
    model,
    stats,
    renderMode,
    background,
    autoRotate,
    loadModel,
    setLoading,
    setError,
    setRenderMode,
    setBackground,
    toggleAutoRotate,
    panelsVisible,
    togglePanels,
  } = useViewerStore()
  const [menuOpen, setMenuOpen] = useState<MenuKey>(null)
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 打开"打开"下拉时刷新最近文件列表
  useEffect(() => {
    if (menuOpen === 'file') {
      window.electronAPI?.getRecentFiles().then(setRecentFiles).catch(() => setRecentFiles([]))
    }
  }, [menuOpen])

  const handleOpenFile = async () => {
    setMenuOpen(null)
    if (!window.electronAPI) {
      setError('Electron API 不可用')
      return
    }

    try {
      setLoading(true)
      const result = await window.electronAPI.openFile()

      if (result) {
        if (result.type === 'glb') {
          loadModel({ buffer: result.buffer, fileName: result.fileName, size: result.size })
        } else {
          loadModel({
            buffer: new ArrayBuffer(0),
            fileName: result.fileName,
            size: result.size,
            gltfPackage: result.gltfPackage,
          })
        }
      } else {
        setLoading(false)
      }
    } catch (err) {
      setError(`打开文件失败: ${err}`)
    }
  }

  const handleModeChange = (mode: RenderMode) => {
    setRenderMode(mode)
    setMenuOpen(null)
  }

  const handleBgChange = (bg: BackgroundPreset) => {
    setBackground(bg)
    setMenuOpen(null)
  }

  const applyLoadedResult = (result: NonNullable<Awaited<ReturnType<NonNullable<typeof window.electronAPI>['openFile']>>>) => {
    if (result.type === 'glb') {
      loadModel({ buffer: result.buffer, fileName: result.fileName, size: result.size })
    } else {
      loadModel({
        buffer: new ArrayBuffer(0),
        fileName: result.fileName,
        size: result.size,
        gltfPackage: result.gltfPackage,
      })
    }
  }

  const handleOpenRecent = async (filePath: string) => {
    if (!window.electronAPI) return
    try {
      setLoading(true)
      const result = await window.electronAPI.openRecentFile(filePath)
      if (result) {
        applyLoadedResult(result)
      } else {
        setError('文件不存在或无法读取')
        setLoading(false)
      }
    } catch (err) {
      setError(`打开文件失败: ${err}`)
    }
    setMenuOpen(null)
  }

  const handleClearRecent = async () => {
    await window.electronAPI?.clearRecentFiles()
    setRecentFiles([])
  }

  const handleLoadExample = async (key: string) => {
    const example = EXAMPLE_MODELS.find((e) => e.key === key)
    if (!example) return
    try {
      setLoading(true)
      const buffer = await example.build()
      loadModel({ buffer, fileName: `示例-${example.label}.glb`, size: buffer.byteLength })
    } catch (err) {
      setError(`生成示例失败: ${err instanceof Error ? err.message : String(err)}`)
    }
    setMenuOpen(null)
  }

  const handleSave = async () => {
    setMenuOpen(null)
    if (!window.electronAPI) {
      setError('Electron API 不可用')
      return
    }
    try {
      const data = await exportSceneToGLB()
      const result = await window.electronAPI.saveFile(data)
      if (result.status === 'no-file') {
        // 无当前文件路径（如示例模型/拖拽打开），转另存为
        await handleSaveAs()
      } else if (result.status === 'error') {
        setError(`保存失败: ${result.message}`)
      } else if (result.status === 'ok') {
        setError(null)
      }
    } catch (err) {
      setError(`导出失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSaveAs = async () => {
    setMenuOpen(null)
    if (!window.electronAPI) {
      setError('Electron API 不可用')
      return
    }
    try {
      const data = await exportSceneToGLB()
      const result = await window.electronAPI.saveFileAs(data)
      if (result.status === 'error') {
        setError(`另存为失败: ${result.message}`)
      } else if (result.status === 'ok') {
        setError(null)
      }
    } catch (err) {
      setError(`导出失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleScreenshot = () => {
    setMenuOpen(null)
    const ok = downloadScreenshot(`glb-viewer-${Date.now()}.png`)
    if (!ok) setError('截图失败：渲染器未就绪')
  }

  const handleFullscreen = () => {
    setMenuOpen(null)
    if (!window.electronAPI) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  return (
    <div className="toolbar" ref={rootRef}>
      <div className="toolbar-left">
        <span className="toolbar-title">GLB Viewer</span>
        {/* 打开（含最近文件） */}
        <div className="dropdown">
          <button
            className="toolbar-button"
            onClick={() => setMenuOpen(menuOpen === 'file' ? null : 'file')}
          >
            打开 ▾
          </button>
          {menuOpen === 'file' && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={handleOpenFile}>
                📂 打开文件...
              </button>
              <div className="recent-divider" />
              <div className="dropdown-label">最近打开</div>
              {recentFiles.length === 0 ? (
                <div className="recent-empty">暂无记录</div>
              ) : (
                <>
                  {recentFiles.map((f) => (
                    <button
                      key={f.path}
                      className="dropdown-item recent-item"
                      onClick={() => handleOpenRecent(f.path)}
                      title={f.path}
                    >
                      <span className="recent-name">{f.fileName}</span>
                      <span className="recent-size">{formatSize(f.size)}</span>
                    </button>
                  ))}
                  <button className="dropdown-item recent-clear" onClick={handleClearRecent}>
                    清空记录
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 文件操作（仅加载模型后可用） */}
        {model && (
          <div className="dropdown">
            <button
              className="toolbar-button secondary"
              onClick={() => setMenuOpen(menuOpen === 'actions' ? null : 'actions')}
            >
              文件 ▾
            </button>
            {menuOpen === 'actions' && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={handleSave}>
                  💾 保存
                </button>
                <button className="dropdown-item" onClick={handleSaveAs}>
                  另存为...
                </button>
                <div className="recent-divider" />
                <button className="dropdown-item" onClick={handleScreenshot}>
                  📷 截图 (PNG)
                </button>
                <button className="dropdown-item" onClick={handleFullscreen}>
                  ⛶ 全屏
                </button>
              </div>
            )}
          </div>
        )}

        {/* 示例模型 */}
        <div className="dropdown">
          <button
            className="toolbar-button secondary"
            onClick={() => setMenuOpen(menuOpen === 'examples' ? null : 'examples')}
          >
            示例 ▾
          </button>
          {menuOpen === 'examples' && (
            <div className="dropdown-menu">
              {EXAMPLE_MODELS.map((m) => (
                <button
                  key={m.key}
                  className="dropdown-item"
                  onClick={() => handleLoadExample(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {model && (
          <>
            <span className="toolbar-filename" title={model.fileName}>
              {model.fileName}
            </span>

            {/* 显示设置（渲染模式+背景+自动旋转+面板开关） */}
            <div className="dropdown">
              <button
                className="toolbar-button secondary"
                onClick={() => setMenuOpen(menuOpen === 'display' ? null : 'display')}
              >
                显示 ▾
              </button>
              {menuOpen === 'display' && (
                <div className="dropdown-menu display-menu">
                  <div className="dropdown-label">渲染模式</div>
                  {RENDER_MODES.map((m) => (
                    <button
                      key={m.value}
                      className={`dropdown-item ${m.value === renderMode ? 'active' : ''}`}
                      onClick={() => handleModeChange(m.value)}
                    >
                      {m.label}
                    </button>
                  ))}
                  <div className="recent-divider" />
                  <div className="dropdown-label">背景</div>
                  {BG_OPTIONS.map((b) => (
                    <button
                      key={b.value}
                      className={`dropdown-item ${b.value === background ? 'active' : ''}`}
                      onClick={() => handleBgChange(b.value)}
                    >
                      <span
                        className="bg-swatch"
                        style={{ backgroundColor: BACKGROUND_COLORS[b.value] }}
                      />
                      {b.label}
                    </button>
                  ))}
                  <div className="recent-divider" />
                  <button
                    className={`dropdown-item ${autoRotate ? 'active' : ''}`}
                    onClick={() => {
                      toggleAutoRotate()
                      setMenuOpen(null)
                    }}
                  >
                    ⟳ 自动旋转
                  </button>
                  <button
                    className={`dropdown-item ${panelsVisible ? 'active' : ''}`}
                    onClick={() => {
                      togglePanels()
                      setMenuOpen(null)
                    }}
                  >
                    ▣ 显示侧栏面板
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 右侧统计 */}
      {stats && (
        <div className="toolbar-stats">
          <span title="顶点数">V: {stats.vertices.toLocaleString()}</span>
          <span title="三角面">F: {stats.triangles.toLocaleString()}</span>
          <span title="网格数">M: {stats.meshes}</span>
          <span title="材质数">Mat: {stats.materials}</span>
          <span title="纹理数">Tex: {stats.textures}</span>
        </div>
      )}
    </div>
  )
}