'use client'

import { useState } from 'react'
import { User, Smile, Play, ChevronDown } from 'lucide-react'
import { getAnimationsByType, getCategoriesForType, type AnimationEntry } from '@/utils/animationCatalog'

interface AnimationPickerProps {
  type: 'pose' | 'emotion' | 'clip'
  selectedId: string | null
  onSelect: (id: string | null) => void
  compact?: boolean
}

const TYPE_ICONS = {
  pose: User,
  emotion: Smile,
  clip: Play,
}

const TYPE_LABELS = {
  pose: 'Poses',
  emotion: 'Emotions',
  clip: 'Animations',
}

export default function AnimationPicker({
  type,
  selectedId,
  onSelect,
  compact = false
}: AnimationPickerProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(!compact)

  const animations = getAnimationsByType(type)
  const categories = getCategoriesForType(type)
  const Icon = TYPE_ICONS[type]

  const selectedAnimation = animations.find(a => a.id === selectedId)

  // Group animations by category
  const groupedAnimations = categories.reduce((acc, category) => {
    acc[category] = animations.filter(a => a.category === category)
    return acc
  }, {} as Record<string, AnimationEntry[]>)

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-200">
            {selectedAnimation?.name || `Select ${TYPE_LABELS[type]}`}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-400">{TYPE_LABELS[type]}</span>
        </div>
        {selectedId && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Groups */}
      <div className="space-y-1">
        {categories.map((category) => (
          <div key={category}>
            {/* Category Header */}
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <span className="text-xs text-slate-400 capitalize">{category}</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-500 transition-transform ${
                  expandedCategory === category ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Category Items */}
            {expandedCategory === category && (
              <div className="mt-1 pl-2 space-y-0.5">
                {groupedAnimations[category].map((anim) => (
                  <button
                    key={anim.id}
                    onClick={() => onSelect(anim.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      selectedId === anim.id
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{anim.name}</span>
                      {anim.looping && (
                        <span className="text-[10px] text-slate-500">loop</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Select Grid (for non-compact mode) */}
      {!compact && animations.length <= 12 && (
        <div className="grid grid-cols-3 gap-1 mt-2">
          {animations.slice(0, 9).map((anim) => (
            <button
              key={anim.id}
              onClick={() => onSelect(anim.id)}
              className={`px-2 py-1.5 rounded text-xs truncate transition-colors ${
                selectedId === anim.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
              }`}
              title={anim.name}
            >
              {anim.name}
            </button>
          ))}
        </div>
      )}

      {compact && isExpanded && (
        <button
          onClick={() => setIsExpanded(false)}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-300 py-1"
        >
          Collapse
        </button>
      )}
    </div>
  )
}
