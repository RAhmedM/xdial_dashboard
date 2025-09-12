"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SimpleSlider } from "@/components/ui/simple-slider"
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react"

interface AudioPlayerProps {
  src: string
  recordingId: string
  isPlaying: boolean
  onPlayStateChange: (playing: boolean) => void
}

export function AudioPlayer({ src, recordingId, isPlaying, onPlayStateChange }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current) return

    try {
      setError(null)
      setIsLoading(true)

      if (isPlaying) {
        audioRef.current.pause()
        onPlayStateChange(false)
      } else {
        // Pause any other playing audio
        const allAudio = document.querySelectorAll('audio')
        allAudio.forEach(audio => {
          if (audio !== audioRef.current) {
            audio.pause()
          }
        })

        await audioRef.current.play()
        onPlayStateChange(true)
      }
    } catch (err) {
      console.error('Error playing audio:', err)
      setError('Failed to play audio')
      onPlayStateChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  // Handle load metadata
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  // Handle audio end
  const handleEnded = () => {
    setCurrentTime(0)
    onPlayStateChange(false)
  }

  // Handle seek
  const handleSeek = (value: number[]) => {
    if (audioRef.current && duration > 0) {
      const seekTime = (value[0] / 100) * duration
      audioRef.current.currentTime = seekTime
      setCurrentTime(seekTime)
    }
  }

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume
        setIsMuted(false)
      } else {
        audioRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  // Skip forward/backward
  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        Math.min(duration, audioRef.current.currentTime + seconds)
      )
    }
  }

  // Format time
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Effect to handle external play state changes
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err)
          onPlayStateChange(false)
        })
      } else if (!isPlaying && !audioRef.current.paused) {
        audioRef.current.pause()
      }
    }
  }, [isPlaying, onPlayStateChange])

  // Progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={(e) => {
          console.error('Audio error:', e)
          setError('Failed to load audio')
          setIsLoading(false)
        }}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        preload="metadata"
      />

      {/* Error Message */}
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      {/* Progress Bar */}
      <div className="space-y-1">
        <SimpleSlider
          value={[progressPercentage]}
          onValueChange={handleSeek}
          max={100}
          step={0.1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Skip Back */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => skip(-15)}
            disabled={!duration}
            className="h-8 w-8 p-0"
            title="Skip back 15s"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          {/* Play/Pause */}
          <Button
            size="sm"
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className="h-10 w-10 p-0"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {/* Skip Forward */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => skip(15)}
            disabled={!duration}
            className="h-8 w-8 p-0"
            title="Skip forward 15s"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 min-w-0 flex-1 max-w-32 ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleMute}
            className="h-8 w-8 p-0 flex-shrink-0"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <div className="flex-1 min-w-0">
            <SimpleSlider
              value={[isMuted ? 0 : volume * 100]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
