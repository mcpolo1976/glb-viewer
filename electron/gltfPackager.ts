/**
 * glTF 外部资源打包器：读取 .gltf 文件及其引用的外部资源（.bin / 纹理），
 * 将全部资源封装为 { gltfJson: object, resources: Map<uri, ArrayBuffer> }，
 * 渲染进程解包后通过 GLTFLoader.setURLModifier 加载。
 */

import { readFile } from 'fs/promises'
import { join, dirname } from 'path'

export interface GltfPackage {
  /** 解析后的 glTF JSON */
  gltfJson: Record<string, unknown>
  /** 外部资源映射（uri → ArrayBuffer） */
  resources: Record<string, ArrayBuffer>
}

/**
 * 打包 glTF 文件及其外部资源
 * @param gltfPath glTF 文件绝对路径
 * @returns 包含 JSON 和所有外部资源的对象
 */
export async function packGltfResources(gltfPath: string): Promise<GltfPackage> {
  const raw = await readFile(gltfPath, 'utf-8')
  const gltfJson = JSON.parse(raw) as Record<string, unknown>
  const baseDir = dirname(gltfPath)
  const resources: Record<string, ArrayBuffer> = {}

  // 收集所有外部资源 URI
  const uris = new Set<string>()

  // buffers
  const buffers = gltfJson.buffers as Array<{ uri?: string }> | undefined
  if (buffers) {
    buffers.forEach((buf) => {
      if (buf.uri && !isDataUri(buf.uri)) uris.add(buf.uri)
    })
  }

  // images
  const images = gltfJson.images as Array<{ uri?: string }> | undefined
  if (images) {
    images.forEach((img) => {
      if (img.uri && !isDataUri(img.uri)) uris.add(img.uri)
    })
  }

  // 读取外部文件
  await Promise.all(
    Array.from(uris).map(async (uri) => {
      const filePath = join(baseDir, decodeURIComponent(uri))
      try {
        const buf = await readFile(filePath)
        resources[uri] = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      } catch (e) {
        console.warn(`[glTF] 无法读取外部资源: ${filePath}`, e)
      }
    }),
  )

  return { gltfJson, resources }
}

function isDataUri(uri: string): boolean {
  return uri.startsWith('data:')
}