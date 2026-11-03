import { useViewerStore } from '@/store/viewerStore'
import './Properties.css'

interface VectorRowProps {
  label: string
  values: [number, number, number]
  unit?: string
  precision?: number
}

function VectorRow({ label, values, unit = '', precision = 3 }: VectorRowProps) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <div className="prop-values">
        {values.map((v, i) => (
          <span key={i} className="prop-value">
            {v.toFixed(precision)}
            {unit}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Properties() {
  const nodeInfo = useViewerStore((s) => s.nodeInfo)
  const model = useViewerStore((s) => s.model)
  const panelsVisible = useViewerStore((s) => s.panelsVisible)

  if (!model || !panelsVisible) return null

  return (
    <div className="properties">
      <div className="panel-header">属性</div>
      <div className="props-content">
        {!nodeInfo ? (
          <div className="props-empty">点击场景树中的节点查看属性</div>
        ) : (
          <>
            <div className="prop-section">
              <div className="prop-row">
                <span className="prop-label">名称</span>
                <span className="prop-text" title={nodeInfo.name}>
                  {nodeInfo.name}
                </span>
              </div>
              <div className="prop-row">
                <span className="prop-label">类型</span>
                <span className="prop-text">{nodeInfo.type}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">可见</span>
                <span className="prop-text">{nodeInfo.visible ? '是' : '否'}</span>
              </div>
            </div>

            <div className="prop-section-title">变换</div>
            <VectorRow label="位置" values={nodeInfo.position} />
            <VectorRow label="旋转°" values={nodeInfo.rotation} precision={1} />
            <VectorRow label="缩放" values={nodeInfo.scale} />

            {nodeInfo.mesh && (
              <>
                <div className="prop-section-title">网格</div>
                <div className="prop-row">
                  <span className="prop-label">顶点</span>
                  <span className="prop-text">
                    {nodeInfo.mesh.vertices.toLocaleString()}
                  </span>
                </div>
                <div className="prop-row">
                  <span className="prop-label">三角面</span>
                  <span className="prop-text">
                    {nodeInfo.mesh.triangles.toLocaleString()}
                  </span>
                </div>
                {nodeInfo.mesh.materialNames.length > 0 && (
                  <div className="prop-row">
                    <span className="prop-label">材质</span>
                    <div className="prop-tags">
                      {nodeInfo.mesh.materialNames.map((name) => (
                        <span key={name} className="prop-tag">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {nodeInfo.mesh.textures.length > 0 && (
                  <>
                    <div className="prop-section-title">纹理</div>
                    <div className="prop-textures">
                      {nodeInfo.mesh.textures.map((t) => (
                        <div key={t.slot} className="prop-texture" title={`${t.width}×${t.height}`}>
                          <img src={t.dataUrl} alt={t.label} />
                          <span className="prop-texture-label">{t.label}</span>
                          <span className="prop-texture-size">
                            {t.width}×{t.height}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}