'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Filter, Eye, EyeOff } from 'lucide-react'

interface Node {
  id: string
  color?: string
  type?: string
}

interface ColorFilterProps {
  nodes: Node[]
  onFilterChange: (visibleNodeIds: string[]) => void
  className?: string
}

interface ColorGroup {
  color: string
  count: number
  visible: boolean
  nodeIds: string[]
}

export function ColorFilter({ nodes, onFilterChange, className }: ColorFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>([])
  const [showAllColors, setShowAllColors] = useState(true)

  // Memoize node IDs to prevent re-grouping when only node positions change
  const nodeSnapshot = React.useMemo(() =>
    JSON.stringify(nodes.map(n => ({ id: n.id, color: n.color, type: n.type }))),
    [nodes]
  )

  useEffect(() => {
    // Group nodes by color
    const colorMap = new Map<string, ColorGroup>()

    nodes.forEach(node => {
      const color = node.color || '#ffffff' // Default to white if no color

      if (colorMap.has(color)) {
        const group = colorMap.get(color)!
        group.count++
        group.nodeIds.push(node.id)
      } else {
        colorMap.set(color, {
          color,
          count: 1,
          visible: true,
          nodeIds: [node.id]
        })
      }
    })

    setColorGroups(Array.from(colorMap.values()).sort((a, b) => b.count - a.count))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeSnapshot])

  useEffect(() => {
    // Calculate visible nodes
    if (showAllColors) {
      onFilterChange(nodes.map(node => node.id))
    } else {
      const visibleNodeIds = colorGroups
        .filter(group => group.visible)
        .flatMap(group => group.nodeIds)
      onFilterChange(visibleNodeIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorGroups, showAllColors])

  const toggleColorVisibility = (color: string) => {
    setColorGroups(prev => 
      prev.map(group => 
        group.color === color 
          ? { ...group, visible: !group.visible }
          : group
      )
    )
    setShowAllColors(false)
  }

  const toggleAll = () => {
    if (showAllColors) {
      // Hide all
      setColorGroups(prev => prev.map(group => ({ ...group, visible: false })))
      setShowAllColors(false)
    } else {
      // Show all
      setColorGroups(prev => prev.map(group => ({ ...group, visible: true })))
      setShowAllColors(true)
    }
  }

  const hideAllExcept = (targetColor: string) => {
    setColorGroups(prev => 
      prev.map(group => ({
        ...group,
        visible: group.color === targetColor
      }))
    )
    setShowAllColors(false)
  }

  const visibleCount = colorGroups.filter(group => group.visible).reduce((sum, group) => sum + group.count, 0)
  const totalCount = nodes.length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 w-8 p-0 ${className}`}
          title={`Color Filter (${visibleCount}/${totalCount} nodes visible)`}
        >
          <Filter className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Color Filter
            <span className="text-sm font-normal text-muted-foreground">
              ({visibleCount}/{totalCount} visible)
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex gap-2">
            <Button
              onClick={toggleAll}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {showAllColors ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAllColors ? 'Hide All' : 'Show All'}
            </Button>
          </div>

          {/* Color groups */}
          <div className="space-y-2 max-h-80 overflow-auto">
            {colorGroups.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No nodes to filter
              </p>
            ) : (
              colorGroups.map((group) => (
                <Card key={group.color} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        className="w-6 h-6 rounded border-2 border-border hover:border-primary transition-colors"
                        style={{ backgroundColor: group.color }}
                        onClick={() => toggleColorVisibility(group.color)}
                        title={`Toggle ${group.color}`}
                      />
                      <span className="text-sm font-medium">
                        {group.count} node{group.count === 1 ? '' : 's'}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {group.color}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => hideAllExcept(group.color)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        title="Show only this color"
                      >
                        Only
                      </Button>
                      <Button
                        onClick={() => toggleColorVisibility(group.color)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title={group.visible ? 'Hide' : 'Show'}
                      >
                        {group.visible ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {!showAllColors && visibleCount < totalCount && (
            <div className="text-center">
              <Button
                onClick={() => {
                  setColorGroups(prev => prev.map(group => ({ ...group, visible: true })))
                  setShowAllColors(true)
                }}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Reset Filter
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}