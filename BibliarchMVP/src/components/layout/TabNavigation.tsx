"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import {
  FileText,
  Users,
  Clock,
  Globe,
  Film,
  Home
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: string
  icon: React.ReactNode
  path: string
}

interface TabNavigationProps {
  storyId?: string
}

export function TabNavigation({ storyId }: TabNavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(true)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Handle Escape key to toggle toolbar visibility
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      setIsVisible(prev => !prev)
      setHasAnimated(true)
    }
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // If no story is selected, don't show tabs
  if (!storyId) return null

  const tabs: Tab[] = [
    {
      id: "home",
      label: "Home",
      icon: <Home className="w-5 h-5" />,
      path: "/",
    },
    {
      id: "notes",
      label: "Notes",
      icon: <FileText className="w-5 h-5" />,
      path: `/story/${storyId}/notes`,
    },
    {
      id: "characters",
      label: "Characters",
      icon: <Users className="w-5 h-5" />,
      path: `/story/${storyId}/characters`,
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: <Clock className="w-5 h-5" />,
      path: `/story/${storyId}/timeline`,
    },
    {
      id: "world",
      label: "World",
      icon: <Globe className="w-5 h-5" />,
      path: `/story/${storyId}/world`,
    },
    {
      id: "story",
      label: "Story",
      icon: <Film className="w-5 h-5" />,
      path: `/story/${storyId}/scenes`,
    },
  ]

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/"
    return pathname === path
  }

  return (
    <>
      {/* Liquid Glass Top Toolbar - Dark, translucent, skinny */}
      <nav
        className={cn(
          "liquid-toolbar",
          hasAnimated && (isVisible ? "liquid-toolbar-visible" : "liquid-toolbar-hidden"),
          !hasAnimated && !isVisible && "opacity-0 pointer-events-none"
        )}
        style={{
          // Initial state without animation
          opacity: !hasAnimated ? (isVisible ? 1 : 0) : undefined,
          transform: !hasAnimated ? 'translateX(-50%)' : undefined
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.push(tab.path)}
            className={cn(
              "liquid-toolbar-button",
              isActive(tab.path) && "active"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Escape hint - shows when toolbar is hidden */}
      <div className={cn(
        "escape-hint",
        !isVisible && hasAnimated && "visible"
      )}>
        Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px] font-mono mx-0.5">ESC</kbd> to show menu
      </div>
    </>
  )
}
