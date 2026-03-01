"use client"

import type { ReactNode } from "react"

interface RibbonGroupProps {
  label: string
  children: ReactNode
  noDivider?: boolean
}

export default function RibbonGroup({ label, children, noDivider }: RibbonGroupProps) {
  return (
    <div className={`flex flex-col items-center px-2.5 ${noDivider ? '' : 'border-r border-[#3d3d3d]'}`}>
      <div className="flex items-center gap-1 flex-1 py-1">{children}</div>
      <span className="text-[9px] text-[#666] pb-0.5 uppercase tracking-wider select-none">{label}</span>
    </div>
  )
}
