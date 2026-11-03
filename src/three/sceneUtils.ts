import * as THREE from 'three'
import type { TreeNode, NodeInfo, ModelStats, TextureInfo } from '@/store/viewerStore'

/** 纹理槽位与展示名 */
const TEXTURE_SLOTS: { key: keyof THREE.MeshStandardMaterial; slot: string; label: string }[] = [
  { key: 'map', slot: 'map', label: '基础色' },
  { key: 'normalMap', slot: 'normalMap', label: '法线' },
  { key: 'roughnessMap', slot: 'roughnessMap', label: '粗糙度' },
  { key: 'metalnessMap', slot: 'metalnessMap', label: '金属度' },
  { key: 'emissiveMap', slot: 'emissiveMap', label: '自发光' },
  { key: 'aoMap', slot: 'aoMap', label: '环境遮蔽' },
]

/** 纹理图像转 dataURL 缩略图（不支持的类型返回 null） */
function textureToDataUrl(texture: THREE.Texture, maxSize = 96): string | null {
  const image = (texture as THREE.Texture).image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined
  if (!image || typeof image !== 'object' || !('width' in image) || !('height' in image)) {
    return null
  }

  const canvas = document.createElement('canvas')
  // 保持宽高比，最长边缩到 maxSize
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  try {
    ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    // 跨域或压缩纹理等无法绘制
    return null
  }
}

/** 提取 Mesh 材质中的纹理槽位缩略图（按纹理 uuid 去重） */
function extractTextures(mesh: THREE.Mesh): TextureInfo[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const results: TextureInfo[] = []
  const seen = new Set<string>()

  materials.forEach((material) => {
    if (!material) return
    const mat = material as THREE.MeshStandardMaterial
    TEXTURE_SLOTS.forEach(({ key, slot, label }) => {
      const texture = mat[key] as THREE.Texture | null
      if (!texture || seen.has(texture.uuid + slot)) return
      seen.add(texture.uuid + slot)

      const dataUrl = textureToDataUrl(texture)
      if (!dataUrl) return
      const image = texture.image as { width: number; height: number }
      results.push({
        slot,
        label,
        dataUrl,
        width: image.width,
        height: image.height,
      })
    })
  })

  return results
}

/** 从 THREE.Object3D 提取树快照（不含 THREE 引用，可安全存入 store） */
export function buildTree(root: THREE.Object3D): TreeNode {
  const hasMesh =
    (root as THREE.Mesh).isMesh ||
    root.children.some((child) => buildTree(child).hasMesh)

  return {
    uuid: root.uuid,
    name: root.name || root.type,
    type: root.type,
    hasMesh,
    children: root.children.map(buildTree),
  }
}

/** 提取单个节点的可序列化属性 */
export function buildNodeInfo(node: THREE.Object3D): NodeInfo {
  const info: NodeInfo = {
    uuid: node.uuid,
    name: node.name || node.type,
    type: node.type,
    position: [node.position.x, node.position.y, node.position.z],
    rotation: [
      THREE.MathUtils.radToDeg(node.rotation.x),
      THREE.MathUtils.radToDeg(node.rotation.y),
      THREE.MathUtils.radToDeg(node.rotation.z),
    ],
    scale: [node.scale.x, node.scale.y, node.scale.z],
    visible: node.visible,
  }

  if ((node as THREE.Mesh).isMesh) {
    const mesh = node as THREE.Mesh
    const geometry = mesh.geometry
    const posAttr = geometry.getAttribute('position')

    // 顶点数 = position 数量；三角面数从索引或 position 数量推导
    let vertices = posAttr ? posAttr.count : 0
    let triangles = 0
    if (geometry.index) {
      triangles = geometry.index.count / 3
    } else if (posAttr) {
      // 无索引：每个三角形 3 个独立顶点
      triangles = vertices / 3
    }

    // 材质名列表（支持多材质数组）
    const materialNames: string[] = []
    const material = mesh.material
    if (Array.isArray(material)) {
      material.forEach((m) => materialNames.push(m.name || m.type))
    } else if (material) {
      materialNames.push(material.name || material.type)
    }

    info.mesh = { vertices, triangles, materialNames, textures: extractTextures(mesh) }
  }

  return info
}

/** 遍历场景计算整体统计 */
export function buildStats(root: THREE.Object3D): ModelStats {
  let vertices = 0
  let triangles = 0
  let meshes = 0
  const materialSet = new Set<string>()
  const textureSet = new Set<string>()

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    meshes++

    const posAttr = mesh.geometry.getAttribute('position')
    if (posAttr) vertices += posAttr.count

    if (mesh.geometry.index) {
      triangles += mesh.geometry.index.count / 3
    } else if (posAttr) {
      triangles += posAttr.count / 3
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((m) => {
      if (!m) return
      materialSet.add(m.uuid)
      const mat = m as THREE.MeshStandardMaterial
      if (mat.map) textureSet.add(mat.map.uuid)
      if (mat.normalMap) textureSet.add(mat.normalMap.uuid)
      if (mat.roughnessMap) textureSet.add(mat.roughnessMap.uuid)
      if (mat.metalnessMap) textureSet.add(mat.metalnessMap.uuid)
      if (mat.emissiveMap) textureSet.add(mat.emissiveMap.uuid)
      if (mat.aoMap) textureSet.add(mat.aoMap.uuid)
    })
  })

  return {
    vertices,
    triangles: Math.round(triangles),
    meshes,
    materials: materialSet.size,
    textures: textureSet.size,
  }
}
