import { useViewerStore } from '@/store/viewerStore'
import { animationManager } from '@/three/AnimationManager'
import { useState } from 'react'
import './AnimationBar.css'

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2]

export function AnimationBar() {
  const animations = useViewerStore((s) => s.animations)
  const currentAnim = useViewerStore((s) => s.currentAnim)
  const isPlaying = useViewerStore((s) => s.isPlaying)
  const speed = useViewerStore((s) => s.speed)
  const time = useViewerStore((s) => s.time)
  const model = useViewerStore((s) => s.model)

  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showAnimMenu, setShowAnimMenu] = useState(false)

  if (!model || animations.length === 0) return null

  const duration = animations[currentAnim]?.duration || 0
  const progress = duration > 0 ? (time / duration) * 100 : 0

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value)
    const newTime = (percent / 100) * duration
    animationManager.seek(newTime)
  }

  const handleSpeedChange = (s: number) => {
    useViewerStore.getState().setSpeed(s)
    setShowSpeedMenu(false)
  }

  const handleAnimChange = (index: number) => {
    animationManager.switchTo(index)
    setShowAnimMenu(false)
  }

  return (
    <div className="anim-bar">
      <button
        className="anim-play-btn"
        onClick={() => animationManager.togglePlay()}
        title={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>

      <span className="anim-time">{formatTime(time)}</span>

      <div className="anim-progress-wrapper">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          className="anim-progress"
          onChange={handleProgressChange}
        />
        <div className="anim-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <span className="anim-duration">/ {formatTime(duration)}</span>

      <div className="anim-dropdown">
        <button
          className="anim-dropdown-btn"
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
        >
          {speed}×
        </button>
        {showSpeedMenu && (
          <div className="anim-menu">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                className={`anim-menu-item ${speed === s ? 'active' : ''}`}
                onClick={() => handleSpeedChange(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="anim-dropdown">
        <button
          className="anim-dropdown-btn"
          onClick={() => setShowAnimMenu(!showAnimMenu)}
        >
          {animations[currentAnim]?.name || '动画'} ▾
        </button>
        {showAnimMenu && (
          <div className="anim-menu">
            {animations.map((anim, i) => (
              <button
                key={i}
                className={`anim-menu-item ${i === currentAnim ? 'active' : ''}`}
                onClick={() => handleAnimChange(i)}
              >
                {anim.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}