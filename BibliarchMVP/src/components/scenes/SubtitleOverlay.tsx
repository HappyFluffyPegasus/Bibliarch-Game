'use client'

import { useState, useEffect, useRef } from 'react'
import type { DialogueLine } from '@/types/scenes'

interface SubtitleOverlayProps {
  dialogue: DialogueLine | null
  style?: 'classic' | 'cinematic' | 'vn'  // Visual novel style
  typewriterEffect?: boolean
  typewriterSpeed?: number  // Characters per second
}

export default function SubtitleOverlay({
  dialogue,
  style = 'cinematic',
  typewriterEffect = false,
  typewriterSpeed = 30
}: SubtitleOverlayProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const prevDialogueIdRef = useRef<string | null>(null)

  // Handle typewriter effect
  useEffect(() => {
    if (!dialogue) {
      setDisplayedText('')
      setIsTyping(false)
      prevDialogueIdRef.current = null
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // If same dialogue, don't restart
    if (dialogue.id === prevDialogueIdRef.current) {
      return
    }

    prevDialogueIdRef.current = dialogue.id

    if (!typewriterEffect) {
      setDisplayedText(dialogue.text)
      return
    }

    // Start typewriter
    setDisplayedText('')
    setIsTyping(true)

    let currentIndex = 0
    const text = dialogue.text
    const intervalMs = 1000 / typewriterSpeed

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      currentIndex++
      if (currentIndex >= text.length) {
        setDisplayedText(text)
        setIsTyping(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } else {
        setDisplayedText(text.slice(0, currentIndex))
      }
    }, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [dialogue, typewriterEffect, typewriterSpeed])

  if (!dialogue) return null

  // Classic style - simple black bar
  if (style === 'classic') {
    return (
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-2xl w-full px-4">
        <div className="bg-black/80 text-white px-6 py-4 rounded-lg text-center">
          <p className="text-xs text-sky-400 font-medium mb-1">
            {dialogue.characterName}
          </p>
          <p className="text-sm leading-relaxed">
            {displayedText}
            {isTyping && <span className="animate-pulse">|</span>}
          </p>
        </div>
      </div>
    )
  }

  // Cinematic style - full width bar at bottom
  if (style === 'cinematic') {
    return (
      <div className="absolute bottom-0 left-0 right-0">
        {/* Gradient fade from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none" />

        {/* Content */}
        <div className="relative px-8 pb-8 pt-16">
          <div className="max-w-3xl mx-auto">
            <p className="text-sky-400 text-xs font-semibold tracking-wider uppercase mb-2">
              {dialogue.characterName}
            </p>
            <p className="text-white text-lg leading-relaxed drop-shadow-lg">
              {displayedText}
              {isTyping && <span className="animate-pulse">|</span>}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Visual Novel style - dialogue box with nameplate
  if (style === 'vn') {
    return (
      <div className="absolute bottom-4 left-4 right-4">
        <div className="max-w-4xl mx-auto">
          {/* Character nameplate */}
          <div className="inline-block mb-1">
            <div className="bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-1.5 rounded-t-lg shadow-lg">
              <span className="text-white text-sm font-semibold">
                {dialogue.characterName}
              </span>
            </div>
          </div>

          {/* Dialogue box */}
          <div className="bg-slate-900/95 border border-slate-700 rounded-lg rounded-tl-none shadow-2xl backdrop-blur-sm">
            <div className="px-6 py-4">
              <p className="text-slate-100 text-base leading-relaxed">
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-2 h-4 bg-sky-400 animate-pulse ml-0.5" />
                )}
              </p>
            </div>

            {/* Continue indicator */}
            {!isTyping && displayedText === dialogue.text && (
              <div className="absolute bottom-2 right-4">
                <div className="w-3 h-3 border-r-2 border-b-2 border-sky-400 rotate-45 animate-bounce" />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
