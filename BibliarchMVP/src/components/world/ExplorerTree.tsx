"use client"

import { useState, useCallback, type MouseEvent } from "react"
import { ChevronRight, ChevronDown, Flag, Building2, Home, Pentagon, X, LogIn, Mountain, Route, LayoutGrid } from "lucide-react"
import type { WorldObject, WorldNode, WorldLevel, PolygonBorder, RoadSegment, CityLot } from "@/types/world"
import { OBJECT_CATALOG } from "@/lib/terrain/objectCatalog"
import type { WorldObjectCategory } from "@/types/world"

interface ExplorerTreeProps {
  objects: WorldObject[]
  childRegions: WorldNode[]
  childLevel: string | null
  currentLevel: WorldLevel
  selectedObjectIds: string[]
  polygonBorders?: PolygonBorder[]
  roadSegments?: RoadSegment[]
  onDeleteRoad?: (id: string) => void
  lots?: CityLot[]
  onEnterLot?: (lotId: string) => void
  onDeleteLot?: (lotId: string) => void
  selectedExplorerItem?: string | null
  onSelectObject: (id: string, additive: boolean) => void
  onDeleteObject: (ids: string[]) => void
  onEnterRegion: (id: string) => void
  onDeleteBorder: (id: string) => void
  onDrawBorder: () => void
  onSelectTerrain?: () => void
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
  roadSegments,
  onDeleteRoad,
  lots: lotsProp,
  onEnterLot,
  onDeleteLot,
  selectedExplorerItem,
  onSelectObject,
  onDeleteObject,
  onEnterRegion,
  onDeleteBorder,
  onDrawBorder,
  onSelectTerrain,
}: ExplorerTreeProps) {
  // Expand/collapse state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    workspace: true,
    regions: true,
    borders: false,
    roads: false,
    lots: true,
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
  const roads = roadSegments ?? []
  const hasRoads = roads.length > 0
  const lotsList = lotsProp ?? []
  const hasLots = lotsList.length > 0

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
          {/* ── Terrain entry ── */}
          {currentLevel !== 'building' && (
            <TreeRow
              depth={1}
              label="Terrain"
              icon={<Mountain className="w-3 h-3 text-green-400/60" />}
              selected={selectedExplorerItem === 'terrain'}
              onClick={() => onSelectTerrain?.()}
            />
          )}

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

          {/* ── Roads folder ── */}
          {hasRoads && (
            <>
              <TreeRow
                depth={1}
                label={`Roads (${roads.length})`}
                expandable
                expanded={expanded.roads}
                onToggle={() => toggle("roads")}
                icon={<Route className="w-3 h-3 text-yellow-400/60" />}
              />
              {expanded.roads &&
                roads.map((road) => (
                  <TreeRow
                    key={road.id}
                    depth={2}
                    label={`${road.type} (${road.waypoints.length} pts)`}
                    colorDot={road.type === 'highway' ? '#666' : road.type === 'footpath' ? '#aa9' : '#555'}
                    trailing={
                      onDeleteRoad ? (
                        <button
                          className="text-gray-500 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteRoad(road.id)
                          }}
                          title="Delete road"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      ) : undefined
                    }
                  />
                ))}
            </>
          )}

          {/* ── Lots folder ── */}
          {hasLots && (
            <>
              <TreeRow
                depth={1}
                label={`Lots (${lotsList.length})`}
                expandable
                expanded={expanded.lots !== false}
                onToggle={() => toggle("lots")}
                icon={<LayoutGrid className="w-3 h-3 text-purple-400/60" />}
              />
              {expanded.lots !== false &&
                lotsList.map((lot) => (
                  <TreeRow
                    key={lot.id}
                    depth={2}
                    label={lot.name}
                    colorDot={lot.color}
                    onDoubleClick={() => onEnterLot?.(lot.id)}
                    onClick={() => {}}
                    trailing={
                      <span className="flex items-center gap-0.5">
                        {onEnterLot && (
                          <button
                            className="text-sky-500 hover:text-sky-300"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEnterLot(lot.id)
                            }}
                            title="Enter lot"
                          >
                            <LogIn className="w-3 h-3" />
                          </button>
                        )}
                        {onDeleteLot && (
                          <button
                            className="text-gray-500 hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteLot(lot.id)
                            }}
                            title="Delete lot"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
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
                              onSelectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey)
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
