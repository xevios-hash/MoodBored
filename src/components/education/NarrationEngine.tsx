import { useState, useRef, useCallback, useEffect } from 'react'

interface NarrationEngineProps {
  script: string
  rate?: number
  pitch?: number
  autoPlay?: boolean
  onEnd?: () => void
  onWordBoundary?: (word: string) => void
}

export function NarrationEngine({ 
  script, 
  rate = 0.85, 
  pitch = 1.0, 
  autoPlay = false,
  onEnd,
  onWordBoundary 
}: NarrationEngineProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported('speechSynthesis' in window)
  }, [])

  const speak = useCallback(() => {
    if (!isSupported || !script) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(script)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = 1.0

    // Try to get a good English voice
    const voices = window.speechSynthesis.getVoices()
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) 
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0]
    if (englishVoice) utterance.voice = englishVoice

    utterance.onstart = () => {
      setIsPlaying(true)
      setIsPaused(false)
      setProgress(0)
    }

    utterance.onboundary = (event) => {
      if (event.charIndex !== undefined && script.length > 0) {
        setProgress(event.charIndex / script.length)
      }
    }

    utterance.onend = () => {
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(1)
      onEnd?.()
    }

    utterance.onerror = (event) => {
      console.warn('[NarrationEngine] Speech error:', event.error)
      setIsPlaying(false)
      setIsPaused(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [script, rate, pitch, isSupported, onEnd])

  const pause = useCallback(() => {
    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause()
      setIsPaused(true)
    }
  }, [isPlaying, isPaused])

  const resume = useCallback(() => {
    if (isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
    }
  }, [isPaused])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsPlaying(false)
    setIsPaused(false)
    setProgress(0)
  }, [])

  // Auto-play when script changes
  useEffect(() => {
    if (autoPlay && script) {
      speak()
    }
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [script, autoPlay, speak])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  if (!isSupported) {
    return (
      <div className="text-xs text-gray-400">
        Speech not supported in this browser
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* Play/Pause button */}
      <button
        onClick={() => {
          if (!isPlaying) speak()
          else if (isPaused) resume()
          else pause()
        }}
        className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
        title={isPlaying && !isPaused ? 'Pause' : 'Play'}
      >
        {isPlaying && !isPaused ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-purple-500 transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Stop button */}
      <button
        onClick={stop}
        className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
        title="Stop"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" />
        </svg>
      </button>
    </div>
  )
}

// Hook for programmatic speech control
export function useSpeech() {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback((text: string, rate = 0.85, pitch = 1.0) => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = pitch
    window.speechSynthesis.speak(utterance)
  }, [isSupported])

  const stop = useCallback(() => {
    if (isSupported) window.speechSynthesis.cancel()
  }, [isSupported])

  const pause = useCallback(() => {
    if (isSupported) window.speechSynthesis.pause()
  }, [isSupported])

  const resume = useCallback(() => {
    if (isSupported) window.speechSynthesis.resume()
  }, [isSupported])

  return { speak, stop, pause, resume, isSupported }
}
