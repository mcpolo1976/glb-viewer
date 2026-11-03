/**
 * 场景注册表：模块级 Map 桥接 React store 与 THREE 场景对象。
 * React store 不存储 THREE 对象，通过 uuid 引用，由注册表提供查找。
 * 同时管理渲染模式材质切换与场景导出。
 */

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { RenderMode } from '@/store/viewerStore'

/** uuid → THREE.Object3D 映射 */
const registry = new Map<string, THREE.Object3D>()

/** 当前场景根对象 */
let sceneRoot: THREE.Object3D | null = null

/** 原始材质缓存（渲染模式切换前保存） */
const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>()

/** 线框材质（共享） */
const WIREFRAME_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x00ff88,
  wireframe: true,
  transparent: true,
  opacity: 0.8,
})

/** 法线辅助材质 */
const NORMAL_MATERIAL = new THREE.MeshNormalMaterial()

/** UV 棋盘格材质 */
const UV_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x888888 })

/** 注册场景对象及其所有子节点 */
export function registerScene(root: THREE.Object3D) {
  sceneRoot = root
  root.traverse((obj) => {
    registry.set(obj.uuid, obj)
  })
}

/** 清空注册表（模型卸载时调用） */
export function clearRegistry() {
  registry.clear()
  sceneRoot = null
  originalMaterials.clear()
}

/** 按 uuid 获取对象 */
export function getObjectByUuid(uuid: string): THREE.Object3D | undefined {
  return registry.get(uuid)
}

/** 切换节点可见性，返回新状态 */
export function toggleVisibility(uuid: string): boolean | null {
  const obj = registry.get(uuid)
  if (!obj) return null
  obj.visible = !obj.visible
  return obj.visible
}

/** 应用渲染模式（切换材质，保留原始材质缓存） */
export function applyRenderMode(mode: RenderMode) {
  if (!sceneRoot) return
  sceneRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return

    const uuid = mesh.uuid
    if (!originalMaterials.has(uuid)) {
      originalMaterials.set(
        uuid,
        mesh.material as THREE.Material | THREE.Material[],
      )
    }

    switch (mode) {
      case 'normal':
        mesh.material = originalMaterials.get(uuid) as THREE.Material
        break
      case 'wireframe':
        mesh.material = WIREFRAME_MATERIAL
        break
      case 'normals':
        mesh.material = NORMAL_MATERIAL
        break
      case 'uv':
        mesh.material = UV_MATERIAL
        break
    }
  })
}

/** 将当前场景导出为 GLB ArrayBuffer（始终使用原始材质与原始可见性） */
export async function exportSceneToGLB(): Promise<ArrayBuffer> {
  if (!sceneRoot) throw new Error('没有可导出的场景')

  // 快照当前运行时状态（渲染模式替换的材质 + 用户隐藏的节点）
  const stateSnapshot: {
    mesh: THREE.Mesh
    material: THREE.Material | THREE.Material[]
  }[] = []
  const visibilitySnapshot: { obj: THREE.Object3D; visible: boolean }[] = []

  sceneRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      stateSnapshot.push({ mesh, material: mesh.material })
      const original = originalMaterials.get(mesh.uuid)
      if (original !== undefined) mesh.material = original
    }
    visibilitySnapshot.push({ obj, visible: obj.visible })
    obj.visible = true
  })

  try {
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(sceneRoot, { binary: true })
    return result as ArrayBuffer
  } finally {
    // 恢复运行时状态
    stateSnapshot.forEach(({ mesh, material }) => {
      mesh.material = material
    })
    visibilitySnapshot.forEach(({ obj, visible }) => {
      obj.visible = visible
    })
  }
}