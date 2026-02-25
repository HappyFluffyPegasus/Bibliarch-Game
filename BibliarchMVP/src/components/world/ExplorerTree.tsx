"use client"

import { useState, useCallback, type MouseEvent } from "react"
import { ChevronRight, ChevronDown, Flag, Building2, Home, Pentagon, X, LogIn } from "lucide-react"
import type { WorldObject, WorldNode, WorldLevel, PolygonBorder } from "@/types/world"
import { OBJECT_CATALOG } from "@/lib/terrain/objectCatalog"
import type { WorldObjectCategory } from "@/types/world"

interface ExplorerTreeProps {
  objects: WorldObject[]
  childRegions: WorldNode[]
  childLevel: string | null
  currentLevel: WorldLevel
  selectedObjectIds: string[]
  polygonBorders?: PolygonBorder[]
  onSelectObject: (id: string, additive: boolean) => void
  onDeleteObject: (ids: string[]) => void
  onEnterRegion: (id: string) => void
  onDeleteBorder: (id: string) => void
  onDrawBorder: () => void
}

// ── Tree row component ────────────────────────────────────────

interface TreeRowProps {
  depth: number
  label: string
  icon?: React.ReactNode
  selected?: boolean
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  onClick?: (e: MouseEvent) => void
  onDoubleClick?: () => void
  trailing?: React.ReactNode
  colorDot?: string
}

function TreeRow({
  depth,
  label,
  icon,
  selected,
  expandable,
  expanded,
  onToggle,
  onClick,
  onDoubleClick,
  trailing,
  colorDot,
}: TreeRowProps) {
  return (
    <div
      className={`h-6 flex items-center text-[11px] cursor-default select-none pr-1 ${
        selected
          ? "bg-sky-900/50 text-sky-200"
          : "text-gray-300 hover:bg-gray-800/50"
      }`}
      style={{ paddingLeft: depth * 16 + 4 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Expand/collapse chevron */}
      {expandable ? (
        <button
          className="w-4 h-4 flex items-center justify-center shrink-0 text-gray-500"
          onClick={(e) => {
            e.stopPropagation()
            onToggle?.()
          }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}

      {/* Icon */}
      {icon && (
        <span className="w-4 h-4 shrink-0 flex items-center justify-center mr-1">
          {icon}
        </span>
      )}

      {/* Color dot */}
      {colorDot && (
        <span
          className="w-2 h-2 rounded-full shrink-0 mr-1.5"
          style={{ backgroundColor: colorDot }}
        />
      )}

      {/* Label */}
      <span className="truncate flex-1">{label}</span>

      {/* Trailing action */}
      {trailing && (
        <span className="shrink-0 ml-1 flex items-center">{trailing}</span>
      )}
    </div>
  )
}

// ── Category labels ───────────────────────────────────────────

const CATEGORY_LABELS: Record<WorldObjectCategory, string> = {
  building: "Buildings",
  decoration: "Decorations",
  prop: "Props",
  vegetation: "Vegetation",
}

const CATEGORY_ORDER: WorldObjectCategory[] = [
  "building",
  "decoration",
  "prop",
  "vegetation",
]

// ── Level icons ───────────────────────────────────────────────

function levelIcon(level: string) {
  switch (level) {
    case "country":
      return <Flag className="w-3 h-3 text-amber-400/60" />
    case "city":
      return <Building2 className="w-3 h-3 text-blue-400/60" />
    case "building":
      return <Home className="w-3 h-3 text-green-400/60" />
    default:
      return <Flag className="w-3 h-3 text-gray-500" />
  }
}

// ── Main ExplorerTree component ───────────────────────────────

export default function ExplorerTree({
  objects,
  childRegions,
  childLevel,
  currentLevel,
  selectedObjectIds,
  polygonBorders,
  onSelectObject,
  onDeleteObject,
  onEnterRegion,
  onDeleteBorder,
  onDrawBorder,
}: ExplorerTreeProps) {
  // Expand/collapse state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    workspace: true,
    regions: true,
    borders: false,
    objects: true,
  })

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Group objects by category
  const objectsByCategory: Partial<Record<WorldObjectCategory, WorldObject[]>> = {}
  for (const obj of objects) {
    const cat = obj.category
    if (!objectsByCategory[cat]) objectsByCategory[cat] = []
    objectsByCategory[cat]!.push(obj)
  }

  const hasRegions = !!childLevel
  const borders = polygonBorders ?? []
  const hasBorders = borders.length > 0

  return (
    <div className="py-1">
      {/* ── Workspace root ── */}
      <TreeRow
        depth={0}
        label="Workspace"
        expandable
        expanded={expanded.workspace}
        onToggle={() => toggle("workspace")}
        icon={
          <span className="w-3 h-3 rounded bg-sky-600 flex items-center justify-center text-[7px] text-white font-bold">
            W
          </span>
        }
      />

      {expanded.workspace && (
        <>
          {/* ── Regions folder ── */}
          {hasRegions && (
            <>
              <TreeRow
                depth={1}
                label={`Regions (${childRegions.length})`}
                expandable
                expanded={expanded.regions}
                onToggle={() => toggle("regions")}
                icon={<Flag className="w-3 h-3 text-amber-400/60" />}
              />
              {expanded.regions && (
                <>
                  {childRegions.map((region) => (
                    <TreeRow
                      key={region.id}
                      depth={2}
                      label={region.name}
                      icon={levelIcon(childLevel!)}
                      onDoubleClick={() => onEnterRegion(region.id)}
                      onClick={() => {}}
                      trailing={
                        <button
                          className="text-sky-500 hover:text-sky-300"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEnterRegion(region.id)
                          }}
                          title="Enter region"
                        >
                          <LogIn className="w-3 h-3" />
                        </button>
                      }
                    />
                  ))}
                  <TreeRow
                    depth={2}
                    label={`Add ${childLevel === "country" ? "Country" : childLevel === "city" ? "City" : "Building"}...`}
                    icon={<Pentagon className="w-3 h-3 text-gray-500" />}
                    onClick={() => onDrawBorder()}
                  />
                </>
              )}
            </>
          )}

          {/* ── Borders folder ── */}
          {hasBorders && (
            <>
              <TreeRow
                depth={1}
                label={`Borders (${borders.length})`}
                expandable
                expanded={expanded.borders}
                onToggle={() => toggle("borders")}
                icon={<Pentagon className="w-3 h-3 text-orange-400/60" />}
              />
              {expanded.borders &&
                borders.map((border) => (
                  <TreeRow
                    key={border.id}
                    depth={2}
                    label={border.name}
                    colorDot={border.color}
                    trailing={
                      <button
                        className="text-gray-500 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteBorder(border.id)
                        }}
                        title="Delete border"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    }
                  />
                ))}
            </>
          )}

          {/* ── Objects folder ── */}
          <TreeRow
            depth={1}
            label={`Objects (${objects.length})`}
            expandable
            expanded={expanded.objects}
            onToggle={() => toggle("objects")}
            icon={
              <span className="w-3 h-3 rounded bg-emerald-700 flex items-center justify-center text-[7px] text-white font-bold">
                O
              </span>
            }
          />
          {expanded.objects && (
            <>
              {CATEGORY_ORDER.map((cat) => {
                const items = objectsByCategory[cat]
                if (!items || items.length === 0) return null

                const catKey = `objects-${cat}`
                const isExpanded = expanded[catKey] !== false // default open

                return (
                  <div key={cat}>
                    <TreeRow
                      depth={2}
                      label={`${CATEGORY_LABELS[cat]} (${items.length})`}
                      expandable
                      expanded={isExpanded}
                      onToggle={() => toggle(catKey)}
                    />
                    {isExpanded &&
                      items.map((obj) => {
                        const entry = OBJECT_CATALOG[obj.type]
                        const name =
                          obj.name || entry?.name || obj.type
                        const isSelected = selectedObjectIds.includes(obj.id)

                        return (
                          <TreeRow
                            key={obj.id}
                            depth={3}
                            label={name}
                            selected={isSelected}
                            colorDot={obj.color}
                            onClick={(e) =>
                              onSelectObject(obj.id, e.shiftKey)
                            }
                            trailing={
                              <button
                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteObject([obj.id])
                                }}
                                title="Delete object"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            }
                          />
                        )
                      })}
                  </div>
                )
              })}
              {objects.length === 0 && (
                <div className="h-6 flex items-center text-[10px] text-gray-600 pl-12">
                  No objects placed
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
