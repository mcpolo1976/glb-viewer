// 生成含旋转动画的 GLB 测试文件：立方体绕 Y 轴旋转
const { writeFileSync } = require('fs')

// 几何数据（与 test-cube 相同）
const positions = new Float32Array([
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
])
const colors = new Float32Array(24)
for (let i = 0; i < 8; i++) {
  colors[i * 3] = i % 2
  colors[i * 3 + 1] = Math.floor(i / 2) % 2
  colors[i * 3 + 2] = Math.floor(i / 4)
}
const indices = new Uint16Array([
  0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 4, 5, 1, 4, 1, 0,
  3, 2, 6, 3, 6, 7, 1, 5, 6, 1, 6, 2, 4, 0, 3, 4, 3, 7,
])

// 动画关键帧：2 秒绕 Y 轴旋转 360°
const animTimes = new Float32Array([0, 1, 2])
const animQuats = new Float32Array([
  0, 0, 0, 1, // 0°
  0, 1, 0, 0, // 180°
  0, 0, 0, 1, // 360°
])

const pad = (b) => {
  const p = (4 - (b.length % 4)) % 4
  if (!p) return b
  // JSON chunk 用空格填充，BIN chunk 用零填充
  const padByte = Buffer.from([0x20, 0x20, 0x20, 0x20].slice(0, p))
  return Buffer.concat([b, padByte])
}

const padBin = (b) => {
  const p = (4 - (b.length % 4)) % 4
  if (!p) return b
  return Buffer.concat([b, Buffer.alloc(p)])
}

const posB = Buffer.from(positions.buffer)
const colB = Buffer.from(colors.buffer)
const idxB = Buffer.from(indices.buffer)
const timeB = Buffer.from(animTimes.buffer)
const quatB = Buffer.from(animQuats.buffer)

// binary chunk 布局
const oPos = 0
const oCol = oPos + padBin(posB).length
const oIdx = oCol + padBin(colB).length
const oTime = oIdx + padBin(idxB).length
const oQuat = oTime + padBin(timeB).length
const bin = Buffer.concat([padBin(posB), padBin(colB), padBin(idxB), padBin(timeB), padBin(quatB)])

const gltf = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'SpinningCube' }],
  meshes: [
    {
      primitives: [
        { attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2, mode: 4 },
      ],
      name: 'Cube',
    },
  ],
  animations: [
    {
      name: 'Spin',
      channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
      samplers: [
        {
          input: 3,
          output: 4,
          interpolation: 'LINEAR',
        },
      ],
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 8,
      type: 'VEC3',
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    },
    { bufferView: 1, componentType: 5126, count: 8, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
    {
      bufferView: 3,
      componentType: 5126,
      count: 3,
      type: 'SCALAR',
      min: [0],
      max: [2],
    },
    { bufferView: 4, componentType: 5126, count: 3, type: 'VEC4' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: oPos, byteLength: posB.length },
    { buffer: 0, byteOffset: oCol, byteLength: colB.length },
    { buffer: 0, byteOffset: oIdx, byteLength: idxB.length },
    { buffer: 0, byteOffset: oTime, byteLength: timeB.length },
    { buffer: 0, byteOffset: oQuat, byteLength: quatB.length },
  ],
  buffers: [{ byteLength: bin.length }],
}

const jsonB = pad(Buffer.from(JSON.stringify(gltf)))
const total = 12 + 8 + jsonB.length + 8 + bin.length
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(total, 8)
const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonB.length, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(bin.length, 0)
binHeader.writeUInt32LE(0x004e4942, 4)

writeFileSync(__dirname + '/../test-anim.glb', Buffer.concat([header, jsonHeader, jsonB, binHeader, bin]))
console.log('written test-anim.glb,', total, 'bytes')
