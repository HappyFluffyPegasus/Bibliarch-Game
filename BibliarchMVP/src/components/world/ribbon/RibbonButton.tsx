"use client"

import type { ReactNode } from "react"

interface RibbonButtonProps {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
  variant?: 'default' | 'danger'
  size?: 'large' | 'small'
}

export default function RibbonButton({
  icon,
  label,
  active,
  disabled,
  onClick,
  title,
  variant = 'default',
  size = 'small',
}: RibbonButtonProps) {
  if (size === 'large') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title ?? label}
        className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded transition-colors min-w-[44px] ${
          active
            ? variant === 'danger'
              ? 'bg-red-600 text-white'
              : 'bg-[#0066cc] text-white'
            : disabled
            ? 'text-[#666] cursor-not-allowed'
            : 'text-[#ccc] hover:bg-[#383838]'
        }`}
      >
        <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
        <span className="text-[9px] leading-tight">{label}</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`h-7 px-2.5 flex items-center gap-1.5 rounded transition-colors text-[11px] whitespace-nowrap ${
        active
          ? variant === 'danger'
            ? 'bg-red-600 text-white'
            : 'bg-[#0066cc] text-white'
          : disabled
          ? 'text-[#666] cursor-not-allowed'
          : 'text-[#ccc] hover:bg-[#383838]'
      }`}
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
      {label}
    </button>
  )
}
