"use client"

import type { ReactNode } from "react"

interface PropertyRowProps {
  label: string
  children: ReactNode
}

export default function PropertyRow({ label, children }: PropertyRowProps) {
  return (
    <div className="grid grid-cols-[90px_1fr] items-center px-2 py-0.5 hover:bg-[#2d2d2d]">
      <span className="text-[10px] text-[#999] truncate">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
