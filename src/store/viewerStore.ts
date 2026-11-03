import { create } from 'zustand'
import type * as THREE from 'three'

/** glTF 外部资源包 */
export interface GltfPackage {
  gltfJson: Record<string, unknown>
  resources: Record<string, ArrayBuffer>
}

export interface LoadedModel {
  buffer: ArrayBuffer
  fileName: string
  size: number
  /** glTF 外部资源包（.gltf 文件时非空） */
  gltfPackage?: GltfPackage
}

export interface SceneBounds {
  center: THREE.Vector3
  size: THREE.Vector3
}

/** 场景树节点（从 THREE 场景图提取的轻量快照） */
export interface TreeNode {
  uuid: string
  name: string
  type: string
  children: TreeNode[]
  /** 该节点（含子节点）是否包含 Mesh */
  hasMesh: boolean
}

/** 纹理槽位缩略图信息（可序列化） */
export interface TextureInfo {
  /** 材质槽位名（map / normalMap / ...） */
  slot: string
  /** 展示名（基础色 / 法线 / ...） */
  label: string
  /** PNG dataURL 缩略图 */
  dataUrl: string
  /** 原始纹理尺寸 */
  width: number
  height: number
}

/** 选中节点的属性快照（可序列化，不含 THREE 对象） */
export interface NodeInfo {
  uuid: string
  name: string
  type: string
  position: [number, number, number]
  rotation: [number, number, number] // 欧拉角（度）
  scale: [number, number, number]
  visible: boolean
  /** 该节点自身是 Mesh 时的几何统计 */
  mesh?: {
    vertices: number
    triangles: number
    materialNames: string[]
    /** 纹理槽位缩略图（多材质时合并） */
    textures: TextureInfo[]
  }
}

export type RenderMode = 'normal' | 'wireframe' | 'normals' | 'uv'

export interface ModelStats {
  vertices: number
  triangles: number
  meshes: number
  materials: number
  textures: number
}

/** 动画剪辑元数据（轻量，不含 THREE.AnimationClip 引用） */
export interface AnimationMeta {
  name: string
  duration: number
}

/** 预设视角 */
export type ViewPreset =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'reset'

/** 背景色预设 */
export type BackgroundPreset = 'dark' | 'black' | 'white' | 'gray'

export const BACKGROUND_COLORS: Record<BackgroundPreset, string> = {
  dark: '#1a1a1a',
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
}

interface ViewerState {
  model: LoadedModel | null
  isLoading: boolean
  error: string | null
  sceneBounds: SceneBounds | null

  /** 场景树快照 */
  sceneTree: TreeNode | null
  /** 当前选中节点 uuid */
  selectedNode: string | null
  /** 选中节点属性 */
  nodeInfo: NodeInfo | null
  /** 渲染模式 */
  renderMode: RenderMode
  /** 模型统计 */
  stats: ModelStats | null

  /** 动画列表元数据 */
  animations: AnimationMeta[]
  /** 当前播放动画索引（-1 = 未选择） */
  currentAnim: number
  /** 是否正在播放 */
  isPlaying: boolean
  /** 播放倍速 */
  speed: number
  /** 当前播放时间（秒） */
  time: number
  /** 视角切换请求（Canvas 内 CameraBridge 消费后置 null） */
  viewPreset: ViewPreset | null
  /** 相机视场角（度） */
  fov: number
  /** 背景色预设 */
  background: BackgroundPreset
  /** 自动旋转 */
  autoRotate: boolean
  /** 隐藏节点 uuid 列表（用于场景树眼睛图标状态同步） */
  hiddenNodeIds: string[]
  /** 实时帧率（每 0.5s 更新一次，0 = 未统计） */
  fps: number
  /** 渲染曝光（toneMappingExposure，0.1 ~ 3） */
  exposure: number
  /** 剖切平面：各轴位置归一化 -1~1（null = 该轴不剖切） */
  clipping: { x: number | null; y: number | null; z: number | null }
  /** 侧栏面板（场景树/属性）是否可见 */
  panelsVisible: boolean

  loadModel: (model: LoadedModel) => void
  clearModel: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSceneBounds: (center: THREE.Vector3, size: THREE.Vector3) => void
  setSceneTree: (tree: TreeNode | null) => void
  selectNode: (uuid: string | null, info: NodeInfo | null) => void
  setRenderMode: (mode: RenderMode) => void
  setStats: (stats: ModelStats | null) => void
  setAnimations: (animations: AnimationMeta[]) => void
  setCurrentAnim: (index: number) => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: number) => void
  setTime: (time: number) => void
  /** 发起视角切换请求 */
  requestView: (preset: ViewPreset) => void
  /** CameraBridge 消费请求后清除 */
  consumeView: () => void
  setFov: (fov: number) => void
  setBackground: (bg: BackgroundPreset) => void
  toggleAutoRotate: () => void
  /** 切换节点可见性状态（同步场景树眼睛图标） */
  toggleNodeVisibility: (uuid: string) => void
  /** 更新帧率统计（由 Canvas 内 FpsCounter 调用） */
  setFps: (fps: number) => void
  /** 设置渲染曝光 */
  setExposure: (exposure: number) => void
  /** 设置剖切平面位置（null = 关闭该轴剖切） */
  setClipping: (axis: 'x' | 'y' | 'z', value: number | null) => void
  /** 切换侧栏面板显示/隐藏 */
  togglePanels: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  model: null,
  isLoading: false,
  error: null,
  sceneBounds: null,
  sceneTree: null,
  selectedNode: null,
  nodeInfo: null,
  renderMode: 'normal',
  stats: null,
  animations: [],
  currentAnim: -1,
  isPlaying: false,
  speed: 1,
  time: 0,
  viewPreset: null,
  fov: 50,
  background: 'dark',
  autoRotate: false,
  hiddenNodeIds: [],
  fps: 0,
  exposure: 1,
  clipping: { x: null, y: null, z: null },
  panelsVisible: true,

  loadModel: (model) =>
    set({
      model,
      isLoading: false,
      error: null,
      sceneBounds: null,
      sceneTree: null,
      selectedNode: null,
      nodeInfo: null,
      stats: null,
      animations: [],
      currentAnim: -1,
      isPlaying: false,
      speed: 1,
      time: 0,
      viewPreset: null,
      autoRotate: false,
      hiddenNodeIds: [],
      clipping: { x: null, y: null, z: null },
    }),

  clearModel: () =>
    set({
      model: null,
      isLoading: false,
      error: null,
      sceneBounds: null,
      sceneTree: null,
      selectedNode: null,
      nodeInfo: null,
      stats: null,
      animations: [],
      currentAnim: -1,
      isPlaying: false,
      speed: 1,
      time: 0,
      viewPreset: null,
      autoRotate: false,
      hiddenNodeIds: [],
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSceneBounds: (center, size) => set({ sceneBounds: { center, size } }),

  setSceneTree: (sceneTree) => set({ sceneTree }),

  selectNode: (selectedNode, nodeInfo) => set({ selectedNode, nodeInfo }),

  setRenderMode: (renderMode) => set({ renderMode }),

  setStats: (stats) => set({ stats }),

  setAnimations: (animations) => set({ animations }),

  setCurrentAnim: (currentAnim) => set({ currentAnim, time: 0 }),

  setPlaying: (isPlaying) => set({ isPlaying }),

  setSpeed: (speed) => set({ speed }),

  setTime: (time) => set({ time }),

  requestView: (viewPreset) => set({ viewPreset }),

  consumeView: () => set({ viewPreset: null }),

  setFov: (fov) => set({ fov }),

  setBackground: (background) => set({ background }),

  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),

  toggleNodeVisibility: (uuid) =>
    set((s) => {
      const hidden = s.hiddenNodeIds.includes(uuid)
      return {
        hiddenNodeIds: hidden
          ? s.hiddenNodeIds.filter((id) => id !== uuid)
          : [...s.hiddenNodeIds, uuid],
      }
    }),

  setFps: (fps) => set({ fps }),

  setExposure: (exposure) => set({ exposure }),

  setClipping: (axis, value) =>
    set((s) => ({ clipping: { ...s.clipping, [axis]: value } })),

  togglePanels: () => set((s) => ({ panelsVisible: !s.panelsVisible })),
}))