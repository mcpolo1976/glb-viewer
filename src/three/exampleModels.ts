/**
 * 内置示例模型：程序化生成几何体，经 GLTFExporter 序列化为 GLB buffer，
 * 走与打开文件完全一致的加载流程（parse → buildTree → stats）。
 */

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export interface ExampleModel {
  /** 唯一标识 */
  key: string
  /** 菜单展示名 */
  label: string
  /** 生成 GLB ArrayBuffer */
  build: () => Promise<ArrayBuffer>
}

async function sceneToGLB(scene: THREE.Object3D): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene, { binary: true })
  return result as ArrayBuffer
}

function standardMaterial(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, ...opts })
}

/** 彩色方块拼成的 3x3 魔方 */
function buildRubik(): THREE.Group {
  const group = new THREE.Group()
  group.name = '魔方'
  const colors = [0xff4444, 0x44aa44, 0x4466ff, 0xffdd44, 0xff8822, 0xffffff]
  let idx = 0
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.9, 0.9),
          standardMaterial(colors[idx++ % colors.length]),
        )
        cube.name = `块_${x}_${y}_${z}`
        cube.position.set(x, y, z)
        group.add(cube)
      }
    }
  }
  return group
}

/** 中心球 + 环绕卫星 */
function buildPlanet(): THREE.Group {
  const group = new THREE.Group()
  group.name = '星球系统'

  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), standardMaterial(0xffaa33))
  core.name = '恒星'
  group.add(core)

  const ringGroup = new THREE.Group()
  ringGroup.name = '行星轨道'
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12),
      standardMaterial([0x4488ff, 0x44dd88, 0xdd4488, 0x88ddff, 0xcc88ff][i]),
    )
    planet.name = `行星${i + 1}`
    planet.position.set(Math.cos(angle) * 2.5, Math.sin(angle * 2) * 0.4, Math.sin(angle) * 2.5)
    ringGroup.add(planet)
  }
  group.add(ringGroup)
  return group
}

/** 圆环结几何体（莫比乌斯风格） */
function buildKnot(): THREE.Group {
  const group = new THREE.Group()
  group.name = '环结'
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1, 0.35, 128, 24),
    new THREE.MeshStandardMaterial({
      color: 0x66aaff,
      roughness: 0.15,
      metalness: 0.85,
    }),
  )
  knot.name = '环结体'
  group.add(knot)
  return group
}

/** 多材质阶梯地形 */
function buildTerrain(): THREE.Group {
  const group = new THREE.Group()
  group.name = '阶梯地形'
  const materials = [
    standardMaterial(0x338844),
    standardMaterial(0x44aa55),
    standardMaterial(0x66cc66),
    standardMaterial(0x88dd77),
    standardMaterial(0xaadd88),
  ]
  for (let i = 0; i < 5; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(5 - i, 0.5, 5 - i), materials[i])
    step.name = `台阶${i + 1}`
    step.position.y = i * 0.5
    group.add(step)
  }
  return group
}

/** 可供选择的示例列表 */
export const EXAMPLE_MODELS: ExampleModel[] = [
  {
    key: 'knot',
    label: '环结',
    build: () => sceneToGLB(buildKnot()),
  },
  {
    key: 'rubik',
    label: '魔方',
    build: () => sceneToGLB(buildRubik()),
  },
  {
    key: 'planet',
    label: '星球系统',
    build: () => sceneToGLB(buildPlanet()),
  },
  {
    key: 'terrain',
    label: '阶梯地形',
    build: () => sceneToGLB(buildTerrain()),
  },
]