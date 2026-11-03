/**
 * electron-builder 打包包装脚本 — GLB Viewer
 *
 * 处理本机环境问题，再调用 electron-builder：
 * 1. PowerShell PATH 缺失：部分终端 PATH 缺少 WindowsPowerShell 目录，
 *    导致 electron-builder 的 Node module collector `spawn powershell.exe ENOENT`。
 * 2. rename 补丁断言：Windows Defender 锁住刚解压的 Electron 文件导致
 *    `rename win-unpacked.tmp → win-unpacked` EPERM，依赖
 *    pnpm patch 固化的 app-builder-lib 补丁（详见 patches/）。此处仅断言补丁在位。
 *
 * 运行：pnpm build 或 node scripts/build-portable.mjs
 */

import { spawnSync } from 'child_process'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PS_DIR = 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0'

// 1. 注入 PowerShell 目录（幂等）
if (existsSync(PS_DIR) && !process.env.PATH.includes(PS_DIR)) {
  process.env.PATH = `${process.env.PATH};${PS_DIR}`
  console.log(`[build-portable] injected PowerShell dir into PATH`)
}

// 2. 断言 rename 补丁已应用（防止 pnpm install 未跑 / 补丁被覆盖后静默失败）
function findPatchedElectronGet() {
  const pnpmDir = resolve(ROOT, 'node_modules/.pnpm')
  if (!existsSync(pnpmDir)) return null
  const dir = readdirSync(pnpmDir).find(
    (d) => d.startsWith('app-builder-lib@') && existsSync(resolve(pnpmDir, d, 'node_modules/app-builder-lib/out/util/electronGet.js')),
  )
  return dir ? resolve(pnpmDir, dir, 'node_modules/app-builder-lib/out/util/electronGet.js') : null
}

const electronGetPath = findPatchedElectronGet()
const marker = 'PATCH: retry rename'
if (!electronGetPath || !readFileSync(electronGetPath, 'utf-8').includes(marker)) {
  console.error(`[build-portable] ERROR: app-builder-lib rename patch not applied.`)
  console.error(`  Expected marker "${marker}" in:`)
  console.error(`    ${electronGetPath ?? 'node_modules/.pnpm/app-builder-lib@*/...'}`)
  console.error(`  Fix: run "pnpm install" to re-apply patches/ from pnpm-workspace.yaml`)
  process.exit(1)
}

// 3. 调用 electron-builder
const r = spawnSync('pnpm', ['exec', 'electron-builder', '--win', 'portable'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32', // Windows 下 pnpm 是 .cmd，需 shell 解析
})
process.exit(r.status ?? 1)
