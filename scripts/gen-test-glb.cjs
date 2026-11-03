// 生成一个最小 GLB 测试文件：单位立方体 + 顶点色
const { writeFileSync } = require('fs')

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

const posB = Buffer.from(positions.buffer)
const colB = Buffer.from(colors.buffer)
const idxB = Buffer.from(indices.buffer)
const pad = (b) => {
  const p = (4 - (b.length % 4)) % 4
  return p ? Buffer.concat([b, Buffer.alloc(p)]) : b
}
const bin = Buffer.concat([pad(posB), pad(colB), pad(idxB)])

const gltf = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'TestCube' }],
  meshes: [
    {
      primitives: [
        { attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2, mode: 4 },
      ],
      name: 'Cube',
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
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posB.length },
    { buffer: 0, byteOffset: posB.length, byteLength: colB.length },
    {
      buffer: 0,
      byteOffset: posB.length + colB.length,
      byteLength: idxB.length,
    },
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

writeFileSync(__dirname + '/test-cube.glb', Buffer.concat([header, jsonHeader, jsonB, binHeader, bin]))
console.log('written test-cube.glb,', total, 'bytes')
