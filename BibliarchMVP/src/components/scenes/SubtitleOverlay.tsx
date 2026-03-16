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

  // Shared outline text style - white text with thin black outline, no background
  const outlineStyle: React.CSSProperties = {
    color: 'white',
    textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
  }

  // All styles render the same: floating text at the bottom of the screen
  return (
    <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
      <div className="max-w-3xl mx-auto px-4">
        <p className="text-xs font-semibold tracking-wider uppercase mb-1" style={outlineStyle}>
          {dialogue.characterName}
        </p>
        <p className="text-lg leading-relaxed" style={outlineStyle}>
          {displayedText}
          {isTyping && <span className="animate-pulse">|</span>}
        </p>
      </div>
    </div>
  )
}
