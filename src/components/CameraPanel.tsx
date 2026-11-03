import { useViewerStore, type ViewPreset } from '@/store/viewerStore'
import './CameraPanel.css'

const PRESETS: { value: ViewPreset; label: string; title: string }[] = [
  { value: 'front', label: '前', title: '前视图' },
  { value: 'back', label: '后', title: '后视图' },
  { value: 'left', label: '左', title: '左视图' },
  { value: 'right', label: '右', title: '右视图' },
  { value: 'top', label: '顶', title: '顶视图' },
  { value: 'bottom', label: '底', title: '底视图' },
]

const CLIP_AXES: { key: 'x' | 'y' | 'z'; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'z', label: 'Z' },
]

export function CameraPanel() {
  const model = useViewerStore((s) => s.model)
  const requestView = useViewerStore((s) => s.requestView)
  const fov = useViewerStore((s) => s.fov)
  const setFov = useViewerStore((s) => s.setFov)
  const exposure = useViewerStore((s) => s.exposure)
  const setExposure = useViewerStore((s) => s.setExposure)
  const clipping = useViewerStore((s) => s.clipping)
  const setClipping = useViewerStore((s) => s.setClipping)

  if (!model) return null

  return (
    <div className="camera-panel">
      <div className="camera-panel-title">相机</div>

      {/* 预设视角 */}
      <div className="camera-presets">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            className="camera-preset-btn"
            title={p.title}
            onClick={() => requestView(p.value)}
          >
            {p.label}
          </button>
        ))}
        <button
          className="camera-preset-btn reset"
          title="重置视角"
          onClick={() => requestView('reset')}
        >
          ⟲
        </button>
      </div>

      {/* FOV 滑块 */}
      <div className="camera-fov">
        <span className="camera-fov-label">FOV</span>
        <input
          type="range"
          min="20"
          max="120"
          step="1"
          value={fov}
          className="camera-fov-slider"
          onChange={(e) => setFov(parseFloat(e.target.value))}
        />
        <span className="camera-fov-value">{fov}°</span>
      </div>

      {/* 曝光滑块 */}
      <div className="camera-fov">
        <span className="camera-fov-label">曝光</span>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.05"
          value={exposure}
          className="camera-fov-slider"
          onChange={(e) => setExposure(parseFloat(e.target.value))}
        />
        <span className="camera-fov-value">{exposure.toFixed(2)}</span>
      </div>

      {/* 剖切平面：勾选启用 + 滑块控制剖切位置 */}
      <div className="camera-clipping">
        {CLIP_AXES.map(({ key, label }) => {
          const active = clipping[key] !== null
          return (
            <div key={key} className="camera-clip-row">
              <button
                className={`camera-clip-toggle ${active ? 'active' : ''}`}
                title={`${label} 轴剖切开关`}
                onClick={() => setClipping(key, active ? null : 0.5)}
              >
                {label}
              </button>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={clipping[key] ?? 0.5}
                className="camera-fov-slider"
                disabled={!active}
                onChange={(e) => setClipping(key, parseFloat(e.target.value))}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}