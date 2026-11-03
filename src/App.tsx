import { useEffect } from 'react'
import { useViewerStore } from './store/viewerStore'
import { Toolbar } from './components/Toolbar'
import { Viewer } from './components/Viewer'
import { SceneTree } from './components/SceneTree'
import { Properties } from './components/Properties'
import { CameraPanel } from './components/CameraPanel'
import './App.css'

// 全局拖拽事件声明
declare global {
  interface Window {
    __dropFile?: (result: { buffer?: ArrayBuffer; gltfPackage?: any; fileName: string; size: number }) => void
  }
}

function App() {
  const { loadModel } = useViewerStore()
  const panelsVisible = useViewerStore((s) => s.panelsVisible)
  const togglePanels = useViewerStore((s) => s.togglePanels)

  // 注册拖拽文件回调
  useEffect(() => {
    window.__dropFile = (result) => {
      loadModel({
        buffer: result.buffer || new ArrayBuffer(0),
        fileName: result.fileName,
        size: result.size,
        gltfPackage: result.gltfPackage,
      })
    }

    // 拖拽事件监听（仅支持 GLB，glTF 需外部资源暂不支持拖拽）
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const file = e.dataTransfer?.files[0]
      if (file && file.name.match(/\.glb$/i)) {
        const buffer = await file.arrayBuffer()
        loadModel({ buffer, fileName: file.name, size: file.size })
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('drop', handleDrop)
    document.addEventListener('dragover', handleDragOver)

    return () => {
      document.removeEventListener('drop', handleDrop)
      document.removeEventListener('dragover', handleDragOver)
      delete window.__dropFile
    }
  }, [loadModel])

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <SceneTree />
        <Viewer />
        <div className="right-dock">
          <CameraPanel />
          <Properties />
        </div>

        {/* 侧栏折叠/展开边缘把手 */}
        <button
          className="panel-edge-toggle left"
          title={panelsVisible ? '隐藏侧栏面板' : '显示侧栏面板'}
          onClick={togglePanels}
        >
          {panelsVisible ? '◀' : '▶'}
        </button>
        <button
          className="panel-edge-toggle right"
          title={panelsVisible ? '隐藏侧栏面板' : '显示侧栏面板'}
          onClick={togglePanels}
        >
          {panelsVisible ? '▶' : '◀'}
        </button>
      </div>
    </div>
  )
}

export default App