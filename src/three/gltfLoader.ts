import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { WebGLRenderer } from 'three'

/** 配置并返回共享的 GLTFLoader 组件（Draco/KTX2/Meshopt） */
const draco = new DRACOLoader()
// r185 起 setDecoderConfig 已弃用：加载器自动优先 WASM，无 WASM 环境自动回退 JS
draco.setDecoderPath('/draco/')

const ktx2 = new KTX2Loader()
ktx2.setTranscoderPath('/basis/')

/**
 * 全局共享 GLTFLoader 实例。
 * 注意：KTX2 需在 Canvas onCreated 后调用 setupKTX2(renderer)。
 */
export const gltfLoader = new GLTFLoader()
  .setDRACOLoader(draco)
  .setKTX2Loader(ktx2)
  .setMeshoptDecoder(MeshoptDecoder)

/** 渲染器就绪后调用，使 KTX2 根据硬件能力选择压缩格式 */
export function setupKTX2(renderer: WebGLRenderer) {
  ktx2.detectSupport(renderer)
}