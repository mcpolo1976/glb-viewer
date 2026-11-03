import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// 抑制 @react-three/fiber 内部初始化 store 时触发的 "THREE.Clock 已弃用" 警告。
// 原因：R3F 最新版（9.7.0）仍依赖 Clock 的 .elapsedTime/.start()/.stop()，
// 无法迁移到 THREE.Timer；应用自身代码已全部去除 Clock 用法。
// 仅过滤这一条特定消息，其余警告（含我们代码的弃用提示）照常输出。
// 注意：警告发生在 Canvas 挂载时（运行时），此处的顶层语句先于 render() 执行，顺序安全。
const originalWarn = console.warn
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].startsWith('THREE.Clock: This module has been deprecated')
  ) {
    return
  }
  originalWarn.apply(console, args)
}

// 过滤 React DevTools 下载提示（开发模式下 Electron 已集成扩展）
const originalLog = console.log
console.log = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Download the React DevTools')
  ) {
    return
  }
  originalLog.apply(console, args)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)