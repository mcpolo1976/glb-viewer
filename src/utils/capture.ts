import type { WebGLRenderer } from 'three'

/** 模块级引用，Canvas onCreated 时注入 */
let renderer: WebGLRenderer | null = null

export function setRenderer(r: WebGLRenderer) {
  renderer = r
}

export function captureScreenshot(): string | null {
  if (!renderer) return null
  // preserveDrawingBuffer: true 已启用，直接读取帧缓冲
  return (renderer.domElement as HTMLCanvasElement).toDataURL('image/png')
}

export function downloadScreenshot(filename = 'glb-viewer-screenshot.png') {
  const dataUrl = captureScreenshot()
  if (!dataUrl) return false

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
  return true
}