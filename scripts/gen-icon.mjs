/**
 * 零依赖图标生成器 — GLB Viewer
 *
 * 用 Node 内置 zlib 生成多尺寸 ICO 与 PNG。
 * 图标：深色圆角方块背景 + 白色线框立方体（等轴测投影，呼应 GLB 格式）。
 *
 * 运行：node scripts/gen-icon.mjs
 * 输出：build/icon.ico, build/icon.png
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { deflateSync, crc32 } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ==================== 配色 ====================

const BG_COLOR = [26, 26, 26] // #1a1a1a 应用主题色
const EDGE_COLOR = [240, 240, 240] // 近白线框

// 三个可见面的微妙明度差（深色底上营造体积感）
const FACE_RIGHT = [44, 44, 44] // x=1 最亮
const FACE_TOP = [36, 36, 36] // y=1 中间
const FACE_FRONT = [30, 30, 30] // z=-1 最暗

// ==================== 立方体几何（归一化世界坐标）====================

const COS30 = Math.sqrt(3) / 2
const SIN30 = 0.5

/** 立方体投影后宽度约 3.46（±1.732）、高度约 4（±2）→ 缩放到适配图标 */
const CUBE_SCALE = 0.45

/** 等轴测投影：世界 (x,y,z) → 归一化屏幕 (sx, sy) */
function isoProject(x, y, z) {
  const sx = ((x - z) * COS30) / 2 * CUBE_SCALE * 2
  const sy = ((x + z) * SIN30 - y) / 2 * CUBE_SCALE * 2
  return [sx, sy]
}

/**
 * 8 顶点索引约定：
 *   0-3 前面 (z=-1)：左下、右下、右上、左上
 *   4-7 后面 (z=+1)：同序
 */
const CUBE_VERTS = [
  isoProject(-1, -1, -1),
  isoProject(1, -1, -1),
  isoProject(1, 1, -1),
  isoProject(-1, 1, -1),
  isoProject(-1, -1, 1),
  isoProject(1, -1, 1),
  isoProject(1, 1, 1),
  isoProject(-1, 1, 1),
]

/** 12 条边 */
const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0], // 前面
  [4, 5], [5, 6], [6, 7], [7, 4], // 后面
  [0, 4], [1, 5], [2, 6], [3, 7], // 连接棱
]

/** 三个可见面（顶点索引，构成凸多边形） */
const FACES = [
  { verts: [1, 5, 6, 2], color: FACE_RIGHT }, // 右面 x=1
  { verts: [3, 2, 6, 7], color: FACE_TOP }, // 顶面 y=1
  { verts: [0, 1, 2, 3], color: FACE_FRONT }, // 前面 z=-1
]

// ==================== SDF 工具 ====================

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** smoothstep 抗锯齿 */
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** 点到线段距离 */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 1e-12) {
    t = clamp01(((px - ax) * dx + (py - ay) * dy) / len2)
  }
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** 射线法判断点是否在多边形内（凸多边形即可） */
function inPolygon(px, py, verts) {
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i]
    const [xj, yj] = verts[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** 圆角矩形 SDF（中心原点，半尺寸 h，圆角半径 r；负值=内部） */
function sdRoundRect(px, py, h, r) {
  const qx = Math.abs(px) - (h - r)
  const qy = Math.abs(py) - (h - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// ==================== 光栅化 ====================

/** 背景圆角方块参数（归一化空间） */
const BG_HALF = 0.96
const BG_RADIUS = 0.24

/** 渲染图标到 RGBA 缓冲区，size×size */
function renderIcon(size) {
  const buf = new Uint8ClampedArray(size * size * 4)
  const half = (size - 1) / 2
  // 归一化线宽：保证至少 2 物理像素，小图标不会糊
  const edgeWidth = Math.max(0.035, (2 * 2) / size)

  // 面多边形（预索引）
  const facePolys = FACES.map((f) => ({
    pts: f.verts.map((i) => CUBE_VERTS[i]),
    color: f.color,
  }))

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = (px - half) / half // [-1, 1]，图标内归一化坐标
      const ny = -(py - half) / half // 翻转 y：屏幕向下，世界向上

      // --- 背景（圆角方块，透明外缘） ---
      const bgDist = sdRoundRect(nx, ny, BG_HALF, BG_RADIUS)
      const bgAa = 1 - smoothstep(-2 / half, 2 / half, bgDist)
      if (bgAa <= 0) continue // 完全透明像素

      let r = BG_COLOR[0]
      let g = BG_COLOR[1]
      let b = BG_COLOR[2]
      let a = bgAa

      // --- 立方体可见面填充（互不重叠，无需画家算法） ---
      for (const face of facePolys) {
        if (inPolygon(nx, ny, face.pts)) {
          r = face.color[0]
          g = face.color[1]
          b = face.color[2]
          break
        }
      }

      // --- 线框边（白色，抗锯齿） ---
      let edgeAlpha = 0
      for (const [i0, i1] of CUBE_EDGES) {
        const [ax, ay] = CUBE_VERTS[i0]
        const [bx, by] = CUBE_VERTS[i1]
        const d = distToSegment(nx, ny, ax, ay, bx, by)
        edgeAlpha = Math.max(edgeAlpha, 1 - smoothstep(edgeWidth * 0.5, edgeWidth, d))
      }
      if (edgeAlpha > 0) {
        r = r * (1 - edgeAlpha) + EDGE_COLOR[0] * edgeAlpha
        g = g * (1 - edgeAlpha) + EDGE_COLOR[1] * edgeAlpha
        b = b * (1 - edgeAlpha) + EDGE_COLOR[2] * edgeAlpha
        a = Math.max(a, edgeAlpha * bgAa)
      }

      const idx = (py * size + px) * 4
      buf[idx] = r
      buf[idx + 1] = g
      buf[idx + 2] = b
      buf[idx + 3] = Math.round(a * 255)
    }
  }

  return buf
}

// ==================== PNG 编码 ====================

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE((crc32(Buffer.concat([typeBuf, data])) >>> 0), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

/** RGBA 缓冲 → PNG Buffer（8bit RGBA，filter 0） */
function encodePNG(rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // no filter
  ihdr[12] = 0 // no interlace

  const rowLen = width * 4
  const raw = Buffer.alloc((rowLen + 1) * height)
  const rgbaBuf = Buffer.isBuffer(rgba) ? rgba : Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength)
  for (let y = 0; y < height; y++) {
    raw[y * (rowLen + 1)] = 0
    rgbaBuf.copy(raw, y * (rowLen + 1) + 1, y * rowLen, (y + 1) * rowLen)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ==================== ICO 编码 ====================

/** 多尺寸 PNG 打包为 ICO（Vista+ 支持 PNG 条目） */
function encodeICO(images) {
  const dir = Buffer.alloc(6)
  dir.writeUInt16LE(0, 0) // reserved
  dir.writeUInt16LE(1, 2) // type ICO
  dir.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = []
  const datas = []

  for (const { width, height, png } of images) {
    const e = Buffer.alloc(16)
    e[0] = width >= 256 ? 0 : width // 256 记为 0
    e[1] = height >= 256 ? 0 : height
    e[2] = 0 // palette
    e[3] = 0 // reserved
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bpp
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    datas.push(png)
    offset += png.length
  }

  return Buffer.concat([dir, ...entries, ...datas])
}

// ==================== 主流程 ====================

const SIZES = [256, 128, 64, 48, 32, 24, 16]

function main() {
  const buildDir = resolve(ROOT, 'build')
  if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true })

  const images = []
  for (const size of SIZES) {
    process.stderr.write(`Rendering ${size}×${size}... `)
    const png = encodePNG(renderIcon(size), size, size)
    images.push({ width: size, height: size, png })
    process.stderr.write(`${png.length} bytes\n`)

    if (size === 256) {
      writeFileSync(resolve(buildDir, 'icon.png'), png)
    }
  }

  const ico = encodeICO(images)
  writeFileSync(resolve(buildDir, 'icon.ico'), ico)
  process.stderr.write(`Wrote build/icon.ico (${ico.length} bytes) + icon.png\nDone.\n`)
}

main()
