import { useThree } from '@react-three/fiber'
import { useViewerStore } from '@/store/viewerStore'
import { buildNodeInfo } from '@/three/sceneUtils'
import { useEffect } from 'react'

/**
 * Canvas 内桥接组件：
 * 监听 selectedNode uuid，从 THREE 场景图中解析节点属性写入 store。
 * 让 UI 面板（React DOM）无需持有 THREE 对象引用。
 */
export function SelectionBridge() {
  const scene = useThree((state) => state.scene)
  const selectedNode = useViewerStore((state) => state.selectedNode)

  useEffect(() => {
    if (!selectedNode) {
      useViewerStore.getState().selectNode(null, null)
      return
    }

    const node = scene.getObjectByProperty('uuid', selectedNode)
    if (!node) {
      useViewerStore.getState().selectNode(null, null)
      return
    }

    const info = buildNodeInfo(node)
    // 只更新 nodeInfo，保留 selectedNode
    useViewerStore.setState({ nodeInfo: info })
  }, [selectedNode, scene])

  return null
}