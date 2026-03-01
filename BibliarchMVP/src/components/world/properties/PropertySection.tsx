"use client"

import { useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"

interface PropertySectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export default function PropertySection({ title, children, defaultOpen = true }: PropertySectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-6 flex items-center gap-1 px-2 text-[11px] font-medium text-[#999] bg-[#2d2d2d] hover:bg-[#383838] transition-colors select-none"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        {title}
      </button>
      {open && <div className="py-0.5">{children}</div>}
    </div>
  )
}
