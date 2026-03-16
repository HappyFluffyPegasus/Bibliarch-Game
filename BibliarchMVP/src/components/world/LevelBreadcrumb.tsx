"use client"

import { ChevronRight, Globe, Flag, Building2, Home, Sofa } from "lucide-react"
import { WorldLevel, WorldNode } from "@/types/world"
import { cn } from "@/lib/utils"

interface BreadcrumbSegment {
  nodeId: string
  name: string
  level: WorldLevel
}

interface LevelBreadcrumbProps {
  segments: BreadcrumbSegment[]
  onNavigate: (nodeId: string) => void
}

const LEVEL_ICONS: Record<WorldLevel, React.ElementType> = {
  world: Globe,
  country: Flag,
  city: Building2,
  building: Home,
  interior: Sofa,
}

const LEVEL_LABELS: Record<WorldLevel, string> = {
  world: 'World',
  country: 'Country',
  city: 'City',
  building: 'Building',
  interior: 'Interior',
}

export default function LevelBreadcrumb({ segments, onNavigate }: LevelBreadcrumbProps) {
  if (segments.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50 backdrop-blur-sm">
      {segments.map((seg, idx) => {
        const Icon = LEVEL_ICONS[seg.level]
        const isLast = idx === segments.length - 1

        return (
          <div key={seg.nodeId} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            <button
              onClick={() => onNavigate(seg.nodeId)}
              disabled={isLast}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all",
                isLast
                  ? "bg-sky-600/20 text-sky-400 cursor-default"
                  : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-slate-500 mr-0.5">{LEVEL_LABELS[seg.level]}:</span>
              <span className="max-w-[120px] truncate">{seg.name}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Build breadcrumb segments from a node and the nodes map */
export function buildBreadcrumbSegments(
  activeNodeId: string,
  nodes: Record<string, WorldNode>
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = []
  let currentId: string | null = activeNodeId

  while (currentId) {
    const node: WorldNode | undefined = nodes[currentId]
    if (!node) break
    segments.unshift({
      nodeId: node.id,
      name: node.name,
      level: node.level,
    })
    currentId = node.parentId
  }

  return segments
}
