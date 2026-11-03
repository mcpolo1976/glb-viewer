/**
 * React DevTools 后端注入（仅开发模式）。
 *
 * react-devtools-core 的 backend.js 是 UMD 模块，加载后仅暴露
 * { initialize, connectToDevTools }，不会自动连接外部 DevTools。
 * 因此这里显式调用 connectToDevTools() 建立 ws://localhost:8097 连接。
 *
 * 时序要求：必须在 React 初始化之前执行，以便 hook 捕获渲染器注册。
 * 使用方式（index.html）：<script type="module" src="/src/devtools/inject-devtools.ts"></script>
 * 置于 main.tsx 之前，Vite 保证 module 按声明顺序执行。
 */
// @ts-ignore UMD 副作用模块，无类型声明
import * as backend from 'react-devtools-core/dist/backend.js'

const backendAny = backend as unknown as {
  connectToDevTools?: (options?: Record<string, unknown>) => void
  initialize?: () => void
}

// initialize 安装 __REACT_DEVTOOLS_GLOBAL_HOOK__（幂等）
backendAny.initialize?.()

// 连接 standalone DevTools 应用（pnpm exec react-devtools，监听 8097）
// connectToDevTools 自带重试（默认 2s），DevTools 后启动也能连上
backendAny.connectToDevTools?.({
  host: 'localhost',
  port: 8097,
})
