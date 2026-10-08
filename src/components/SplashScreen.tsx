import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { getRandomVideoBackground } from '@/lib/videoBackgrounds'

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)
  const theme = useStore((s) => s.project.settings.theme)
  const isDark = theme === 'dark'

  // Get or create session video (random on each app load)
  const getSessionVideo = () => {
    const stored = sessionStorage.getItem('moodbored-session-video')
    if (stored) {
      try { return JSON.parse(stored) } catch {}
    }
    const video = getRandomVideoBackground()
    sessionStorage.setItem('moodbored-session-video', JSON.stringify(video))
    return video
  }

  const sessionVideo = getSessionVideo()

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 800)
    const done = setTimeout(() => onComplete(), 1200)
    
    // Allow skipping with click/key
    const skip = () => { setFadeOut(true); setTimeout(onComplete, 100) }
    window.addEventListener('click', skip)
    window.addEventListener('keydown', skip)
    
    return () => {
      clearTimeout(timer); clearTimeout(done)
      window.removeEventListener('click', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [onComplete])

  const videoSrc = sessionVideo.url

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        overflow: 'hidden',
        background: isDark ? '#0a0a14' : '#87CEEB',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 800ms ease-out',
      }}
    >
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      {/* Dark overlay for better logo visibility */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)',
        }}
      />

      {/* Logo centered */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <img
          src="/logo-transparent.png"
          alt="MoodBored"
          style={{
            width: 220,
            height: 220,
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.4))',
            animation: 'float 4s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  )
}
