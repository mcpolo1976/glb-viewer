import { useState } from 'react'
import { useViewerStore, type TreeNode } from '@/store/viewerStore'
import { toggleVisibility } from '@/three/sceneRegistry'
import './SceneTree.css'

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const selectedNode = useViewerStore((s) => s.selectedNode)
  const selectNode = useViewerStore((s) => s.selectNode)
  const hiddenNodeIds = useViewerStore((s) => s.hiddenNodeIds)
  const toggleNodeVisibility = useViewerStore((s) => s.toggleNodeVisibility)

  const isSelected = selectedNode === node.uuid
  const hasChildren = node.children.length > 0
  const isHidden = hiddenNodeIds.includes(node.uuid)

  const handleClick = () => {
    // 选中任意节点（有 Mesh 或无都可以选中查看属性）
    selectNode(isSelected ? null : node.uuid, null)
  }

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleVisibility(node.uuid)
    toggleNodeVisibility(node.uuid)
  }

  return (
    <div className="tree-item">
      <div
        className={`tree-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="tree-toggle-placeholder" />
        )}

        <span className="tree-icon">
          {node.type === 'Mesh' ? '◆' : node.type === 'Group' ? '▣' : '●'}
        </span>
        <span className={`tree-name ${isHidden ? 'hidden' : ''}`} title={node.name}>
          {node.name}
        </span>
        <span className="tree-type">{node.type}</span>
        <button
          className={`tree-visibility ${isHidden ? 'off' : ''}`}
          onClick={handleToggleVisibility}
          title={isHidden ? '显示节点' : '隐藏节点'}
        >
          {isHidden ? '🚫' : '👁'}
        </button>
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeItem key={child.uuid} node={child} depth={depth + 1} />
        ))}
    </div>
  )
}

export function SceneTree() {
  const sceneTree = useViewerStore((s) => s.sceneTree)
  const model = useViewerStore((s) => s.model)
  const panelsVisible = useViewerStore((s) => s.panelsVisible)

  if (!model || !panelsVisible) return null

  return (
    <div className="scene-tree">
      <div className="panel-header">场景树</div>
      <div className="tree-content">
        {sceneTree ? (
          <TreeItem node={sceneTree} depth={0} />
        ) : (
          <div className="tree-empty">加载中...</div>
        )}
      </div>
    </div>
  )
}