import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)
  const theme = useStore((s) => s.project.settings.theme)
  const isDark = theme === 'dark'

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 3000)
    const done = setTimeout(() => onComplete(), 3800)
    return () => { clearTimeout(timer); clearTimeout(done) }
  }, [onComplete])

  const videoSrc = isDark ? '/sky-night.mp4' : '/sky-day.mp4'

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
