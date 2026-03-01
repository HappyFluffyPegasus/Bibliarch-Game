"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  FileText,
  Users,
  Clock,
  Globe,
  Film,
  Home,
  Menu,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  path: string
}

interface SidebarNavProps {
  storyId?: string
}

export function SidebarNav({ storyId }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  // Close sidebar on route change using timeout to avoid synchronous setState in effect
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      // Use queueMicrotask to avoid synchronous setState warning
      queueMicrotask(() => setIsOpen(false))
    }
  }, [pathname])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  const navItems: NavItem[] = storyId ? [
    { id: "notes", label: "Notes", icon: FileText, path: `/story/${storyId}/notes` },
    { id: "characters", label: "Characters", icon: Users, path: `/story/${storyId}/characters` },
    { id: "timeline", label: "Timeline", icon: Clock, path: `/story/${storyId}/timeline` },
    { id: "world", label: "World", icon: Globe, path: `/story/${storyId}/world` },
    { id: "scenes", label: "Scenes", icon: Film, path: `/story/${storyId}/scenes` },
  ] : []

  const isActive = (path: string) => pathname === path

  const handleNavigate = (path: string) => {
    router.push(path)
    setIsOpen(false)
  }

  return (
    <>
      {/* Hamburger Button - Fixed top left, compact to fit ribbon tab bar */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed top-1 left-2 z-50",
          "w-9 h-7 rounded-md",
          "bg-slate-700/80 backdrop-blur-sm",
          "flex items-center justify-center",
          "text-slate-300 hover:text-sky-400 hover:bg-slate-600/80",
          "transition-all duration-150",
          "active:scale-95",
          isOpen && "opacity-0 pointer-events-none"
        )}
        aria-label="Open navigation menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-all duration-300",
          isOpen
            ? "bg-black/40 backdrop-blur-sm pointer-events-auto"
            : "bg-transparent pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-out Sidebar - from left */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50",
          "h-full w-72",
          "bg-gradient-to-b from-slate-900 to-slate-800",
          "shadow-2xl shadow-sky-500/10",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <div className="flex justify-end p-4">
          <button
            onClick={() => setIsOpen(false)}
            className={cn(
              "w-10 h-10 rounded-xl",
              "bg-slate-700/80",
              "shadow-md shadow-sky-500/10",
              "flex items-center justify-center",
              "text-slate-300 hover:text-sky-400",
              "transition-all duration-200",
              "hover:scale-105 active:scale-95"
            )}
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-2 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-4 rounded-2xl",
                  "transition-all duration-200",
                  "group",
                  active
                    ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30"
                    : "bg-slate-700/40 hover:bg-slate-700/80 text-slate-200 hover:shadow-md shadow-sky-500/10"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  "transition-all duration-200",
                  active
                    ? "bg-white/20"
                    : "bg-gradient-to-br from-sky-500/10 to-blue-600/10 group-hover:from-sky-500/20 group-hover:to-blue-600/20"
                )}>
                  <Icon className={cn(
                    "w-6 h-6",
                    active ? "text-white" : "text-sky-400"
                  )} />
                </div>
                <span className={cn(
                  "text-lg font-medium",
                  active ? "text-white" : "text-slate-200"
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="mx-6 border-t border-slate-700/50" />

        {/* Home Button */}
        <div className="p-4">
          <button
            onClick={() => handleNavigate("/")}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-4 rounded-2xl",
              "bg-slate-700/40 hover:bg-slate-700/80",
              "text-slate-200 hover:text-sky-400",
              "transition-all duration-200",
              "hover:shadow-md shadow-sky-500/10",
              "group"
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-600/10 group-hover:from-sky-500/20 group-hover:to-blue-600/20 flex items-center justify-center transition-all duration-200">
              <Home className="w-6 h-6 text-sky-400" />
            </div>
            <span className="text-lg font-medium">Home</span>
          </button>
        </div>
      </aside>
    </>
  )
}
