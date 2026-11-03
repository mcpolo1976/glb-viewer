import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useViewerStore, BACKGROUND_COLORS, type GltfPackage } from '@/store/viewerStore'
import { buildTree, buildStats } from '@/three/sceneUtils'
import { animationManager } from '@/three/AnimationManager'
import { gltfLoader, setupKTX2 } from '@/three/gltfLoader'
import {
  registerScene,
  clearRegistry,
  applyRenderMode,
} from '@/three/sceneRegistry'
import { SelectionBridge } from './SelectionBridge'
import { AnimationBar } from './AnimationBar'
import { setRenderer } from '@/utils/capture'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './Viewer.css'

function GLBModel({ buffer, gltfPackage }: { buffer: ArrayBuffer; gltfPackage?: GltfPackage }) {
  const [scene, setScene] = useState<THREE.Group | null>(null)
  const modelRef = useRef<THREE.Group>(null)

  const { setSceneTree, setStats, setSceneBounds, setError } = useViewerStore()

  useEffect(() => {
    let disposed = false

    // glTF 外部资源包：为每个资源创建 blob URL，注册到 URLModifier
    let resourceUrls: (() => void)[] = []
    if (gltfPackage) {
      const urlMap = new Map<string, string>()
      Object.entries(gltfPackage.resources).forEach(([uri, data]) => {
        const blob = new Blob([data])
        const url = URL.createObjectURL(blob)
        urlMap.set(uri, url)
        urlMap.set('./' + uri, url)
        resourceUrls.push(() => URL.revokeObjectURL(url))
      })

      // 注册资源解析器：外部资源 URI → blob URL
      gltfLoader.manager.setURLModifier((url: string) => {
        if (urlMap.has(url)) return urlMap.get(url)!
        const clean = url.replace(/^\.?\//, '')
        if (urlMap.has(clean)) return urlMap.get(clean)!
        return url
      })
    }

    const parseInput: string | ArrayBuffer = gltfPackage
      ? JSON.stringify(gltfPackage.gltfJson)
      : buffer

    gltfLoader.parse(
      parseInput,
      '',
      (gltf: GLTF) => {
        if (disposed) return
        console.warn('[GLBModel] 模型解析成功')
        const root = gltf.scene
        setScene(root)

        // 注册场景对象到 registry（供场景树切换可见性）
        registerScene(root)

        // 初始化动画
        animationManager.init(root, gltf.animations)

        // 提取场景树
        const tree = buildTree(root)
        setSceneTree(tree)

        // 计算统计
        const stats = buildStats(root)
        setStats(stats)

        // 相机取景
        const box = new THREE.Box3().setFromObject(root)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        root.position.x -= center.x
        root.position.z -= center.z
        root.position.y -= box.min.y
        setSceneBounds(center, size)
      },
      (err: unknown) => {
        if (disposed) return
        console.error('[GLBModel] 模型解析失败:', err)
        setError(
          `模型解析失败: ${err instanceof Error ? err.message : String(err)}`,
        )
      },
    )

    return () => {
      disposed = true
      clearRegistry()
      resourceUrls.forEach((revoke) => revoke())
      resourceUrls = []
    }
  }, [buffer, gltfPackage, setSceneTree, setStats, setSceneBounds, setError])

  // 渲染模式切换
  const renderMode = useViewerStore((s) => s.renderMode)
  useEffect(() => {
    if (!scene) return
    applyRenderMode(renderMode)
  }, [scene, renderMode])

  if (!scene) return null
  return <primitive ref={modelRef} object={scene} />
}

/** 每帧驱动动画更新 */
function AnimationDriver() {
  useFrame(() => {
    animationManager.update()
  })
  return null
}

/** 帧率统计：每 0.5s 计算一次写入 store */
function FpsCounter() {
  const acc = useRef({ frames: 0, elapsed: 0 })
  useFrame((_, delta) => {
    const a = acc.current
    a.frames += 1
    a.elapsed += delta
    if (a.elapsed >= 0.5) {
      useViewerStore.getState().setFps(Math.round(a.frames / a.elapsed))
      a.frames = 0
      a.elapsed = 0
    }
  })
  return null
}

/** 曝光控制：将 store 中的 exposure 应用到渲染器 */
function ExposureController() {
  const gl = useThree((state) => state.gl)
  const exposure = useViewerStore((state) => state.exposure)
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  return null
}

/** 剖切平面控制：归一化位置 → 世界坐标平面（局部剖切，作用于材质） */
function ClippingController() {
  const scene = useThree((state) => state.scene)
  const clipping = useViewerStore((state) => state.clipping)
  const sceneBounds = useViewerStore((state) => state.sceneBounds)

  useEffect(() => {
    const planes: THREE.Plane[] = []
    if (sceneBounds) {
      const { size } = sceneBounds
      const maxDim = Math.max(size.x, size.y, size.z)

      // 各轴：值 -1（完整保留）→ 1（剖到另一端），0.5 表示从中间剖
      const addPlane = (
        value: number | null,
        normal: THREE.Vector3,
        centerOffset: number,
      ) => {
        if (value === null) return
        // value -1 → 剖切面在 min 处，value 1 → 在 max 处
        const worldPos = ((value + 1) / 2) * maxDim + centerOffset
        planes.push(new THREE.Plane(normal, -worldPos + maxDim / 2))
      }

      // +方向法线：保留法线一侧（剖切面下方），值越大剖掉越多
      addPlane(clipping.x, new THREE.Vector3(-1, 0, 0), 0)
      addPlane(clipping.y, new THREE.Vector3(0, -1, 0), 0)
      addPlane(clipping.z, new THREE.Vector3(0, 0, -1), 0)
    }

    // localClippingEnabled：材质级剖切，只作用于模型不剖网格地面
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat) => {
        if (!mat) return
        mat.clippingPlanes = planes.length > 0 ? planes : null
        mat.clipShadows = true
        mat.needsUpdate = true
      })
    })
  }, [clipping, sceneBounds, scene])

  return null
}

function CameraRig() {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | undefined
  const sceneBounds = useViewerStore((state) => state.sceneBounds)
  const viewPreset = useViewerStore((state) => state.viewPreset)
  const fov = useViewerStore((state) => state.fov)

  // 首次加载 / 重置：自动取景
  useEffect(() => {
    if (!sceneBounds) return

    const { size } = sceneBounds
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim === 0) return
    const distance = maxDim * 2

    camera.position.set(distance, distance * 0.6, distance)
    camera.near = maxDim / 100
    camera.far = maxDim * 100
    camera.updateProjectionMatrix()

    if (controls) {
      controls.target.set(0, size.y / 2, 0)
      controls.update()
    }
  }, [sceneBounds, camera, controls])

  // 预设视角切换
  useEffect(() => {
    if (!viewPreset || !sceneBounds || !controls) {
      if (viewPreset === 'reset' && sceneBounds === null) {
        useViewerStore.getState().consumeView()
      }
      return
    }

    const { size } = sceneBounds
    const maxDim = Math.max(size.x, size.y, size.z) || 1

    if (viewPreset === 'reset') {
      // 回到自动取景视角
      const distance = maxDim * 2
      camera.position.set(distance, distance * 0.6, distance)
      controls.target.set(0, size.y / 2, 0)
      camera.lookAt(controls.target)
      controls.update()
      useViewerStore.getState().consumeView()
      return
    }

    const dist = maxDim * 3
    const targetY = size.y / 2
    const epsilon = maxDim * 0.001 // 顶/底视时轻微偏移，避免与 up 向量共线

    switch (viewPreset) {
      case 'front':
        camera.position.set(0, targetY, dist)
        break
      case 'back':
        camera.position.set(0, targetY, -dist)
        break
      case 'left':
        camera.position.set(-dist, targetY, 0)
        break
      case 'right':
        camera.position.set(dist, targetY, 0)
        break
      case 'top':
        camera.position.set(epsilon, dist, epsilon)
        break
      case 'bottom':
        camera.position.set(epsilon, -dist, epsilon)
        break
    }

    controls.target.set(0, targetY, 0)
    camera.lookAt(controls.target)
    controls.update()
    useViewerStore.getState().consumeView()
  }, [viewPreset, sceneBounds, camera, controls])

  // FOV 调整
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = fov
    cam.updateProjectionMatrix()
  }, [fov, camera])

  // 无限缩放支持：near/far 跟随相机距离动态调整，避免放大后被裁剪
  useFrame(() => {
    if (!sceneBounds) return
    const maxDim = Math.max(sceneBounds.size.x, sceneBounds.size.y, sceneBounds.size.z) || 1
    const distance = camera.position.distanceTo(
      (controls as { target?: THREE.Vector3 } | undefined)?.target ?? new THREE.Vector3(),
    )
    const newNear = Math.max(distance * 0.001, maxDim * 0.00001)
    const newFar = distance * 1000 + maxDim * 100
    const cam = camera as THREE.PerspectiveCamera
    // 仅在变化明显时更新，避免每帧触发投影矩阵重算
    if (Math.abs(cam.near - newNear) / newNear > 0.5 || Math.abs(cam.far - newFar) / newFar > 1) {
      cam.near = newNear
      cam.far = newFar
      cam.updateProjectionMatrix()
    }
  })

  return null
}

export function Viewer() {
  const { model, isLoading, error } = useViewerStore()
  const sceneBounds = useViewerStore((state) => state.sceneBounds)
  const background = useViewerStore((state) => state.background)
  const autoRotate = useViewerStore((state) => state.autoRotate)
  const fps = useViewerStore((state) => state.fps)

  // 无限缩放：范围相对模型尺寸（0.0001x 深入内部 ~ 100000x 极远）
  const zoomRange = (() => {
    if (!sceneBounds) return { min: 0.001, max: 100000 }
    const maxDim = Math.max(sceneBounds.size.x, sceneBounds.size.y, sceneBounds.size.z) || 1
    return { min: maxDim * 0.0001, max: maxDim * 100000 }
  })()

  return (
    <div className="viewer">
      {isLoading && (
        <div className="viewer-loading">
          <div className="loading-spinner" />
          <span>加载中...</span>
        </div>
      )}

      {error && (
        <div className="viewer-error">
          <span>❌ {error}</span>
        </div>
      )}

      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        shadows="percentage"
        gl={{ antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
        onCreated={({ gl }) => {
          setRenderer(gl)
          setupKTX2(gl)
        }}
      >
        <color attach="background" args={[BACKGROUND_COLORS[background]]} />

        {/* 灯光 */}
        <hemisphereLight args={['#ffffff', '#444444', 0.6]} />
        <directionalLight position={[10, 15, 8]} intensity={1.2} castShadow />
        <directionalLight position={[-10, -5, -8]} intensity={0.3} color="#88aaff" />

        {/* 轨道控制（无限缩放：相对模型尺寸的动态范围） */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={zoomRange.min}
          maxDistance={zoomRange.max}
          zoomSpeed={1.2}
          autoRotate={autoRotate}
          autoRotateSpeed={2}
        />

        {/* 地面网格 */}
        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#404040"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#606060"
          fadeDistance={30}
          fadeStrength={1}
          position={[0, 0, 0]}
        />

        {/* 模型 */}
        {model && <GLBModel buffer={model.buffer} gltfPackage={model.gltfPackage} />}
        <SelectionBridge />
        <AnimationDriver />
        <CameraRig />
        <FpsCounter />
        <ExposureController />
        <ClippingController />
      </Canvas>

      {/* 视口左下角实时统计 */}
      {model && (
        <div className="viewer-fps">
          FPS: {fps}
        </div>
      )}

      {/* 底部悬浮动画控制条 */}
      <AnimationBar />

      {!model && !isLoading && (
        <div className="viewer-placeholder">
          <p>拖拽 GLB 文件到窗口 或 点击"打开 GLB 文件"按钮</p>
        </div>
      )}
    </div>
  )
}