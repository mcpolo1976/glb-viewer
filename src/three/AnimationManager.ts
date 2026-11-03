import * as THREE from 'three'
import { useViewerStore } from '@/store/viewerStore'

/**
 * 动画管理器（模块级单例）：
 * 持有 AnimationMixer 等非序列化 THREE 对象，
 * UI 通过 store 触发操作，渲染循环每帧调用 update()。
 */
class AnimationManager {
  private mixer: THREE.AnimationMixer | null = null
  private actions: THREE.AnimationAction[] = []
  /** 上一帧时间戳（秒），基于 performance.now()（THREE.Clock 已弃用） */
  private lastTime = 0

  /** 模型加载后初始化 mixer */
  init(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.dispose()
    if (clips.length === 0) return

    this.mixer = new THREE.AnimationMixer(root)
    this.actions = clips.map((clip) => this.mixer!.clipAction(clip))

    // 动画元数据写入 store
    useViewerStore.getState().setAnimations(
      clips.map((clip) => ({ name: clip.name || `动画 ${clips.indexOf(clip) + 1}`, duration: clip.duration })),
    )

    // 默认选中第一个动画（不自动播放）
    useViewerStore.getState().setCurrentAnim(0)
    this.actions[0]?.play()
    this.actions[0]?.setEffectiveTimeScale(0) // 暂停状态
  }

  /** 渲染循环每帧调用 */
  update() {
    if (!this.mixer) return

    const now = performance.now() / 1000
    const delta = this.lastTime === 0 ? 0 : Math.min(now - this.lastTime, 0.1)
    this.lastTime = now
    const { isPlaying, speed, currentAnim, time, setTime } = useViewerStore.getState()

    // 同步倍速
    const action = this.actions[currentAnim]
    if (action) {
      action.setEffectiveTimeScale(isPlaying ? speed : 0)
    }

    if (isPlaying) {
      this.mixer.update(delta)

      // 更新进度；到结尾时循环
      const meta = useViewerStore.getState().animations[currentAnim]
      if (meta && meta.duration > 0) {
        const newTime = (time + delta * speed) % meta.duration
        setTime(newTime)
      }
    }
  }

  /** 播放/暂停切换 */
  togglePlay() {
    const { isPlaying, currentAnim } = useViewerStore.getState()
    if (currentAnim < 0) return
    useViewerStore.getState().setPlaying(!isPlaying)
  }

  /** 切换动画 */
  switchTo(index: number) {
    const { currentAnim } = useViewerStore.getState()
    if (index === currentAnim) return

    this.actions[currentAnim]?.stop()
    this.actions[index]?.reset().play()
    this.actions[index]?.setEffectiveTimeScale(0)

    useViewerStore.getState().setCurrentAnim(index)
    useViewerStore.getState().setPlaying(false)
  }

  /** 跳转到指定时间（秒） */
  seek(time: number) {
    const { currentAnim, animations } = useViewerStore.getState()
    const action = this.actions[currentAnim]
    if (!action) return

    const duration = animations[currentAnim]?.duration ?? 0
    const clamped = Math.max(0, Math.min(time, duration))
    action.time = clamped
    useViewerStore.getState().setTime(clamped)
  }

  /** 模型切换/卸载时清理 */
  dispose() {
    this.mixer?.stopAllAction()
    this.mixer = null
    this.actions = []
    this.lastTime = 0
  }
}

export const animationManager = new AnimationManager()