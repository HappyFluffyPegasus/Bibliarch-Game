"use client"

import { useParams } from "next/navigation"
import { FileText, Upload, ChevronRight, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStoryStore } from "@/stores/storyStore"
import { ColorProvider } from "@/components/providers/color-provider"
import { storyTemplates, subCanvasTemplates } from "@/lib/templates"
import dynamic from "next/dynamic"
import { useState, useCallback, useEffect, useMemo } from "react"

// Dynamically import HTMLCanvas to avoid SSR issues with canvas/DOM operations
const HTMLCanvas = dynamic(
  () => import("@/components/canvas/HTMLCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading canvas...</p>
        </div>
      </div>
    )
  }
)

interface CanvasPath {
  id: string
  title: string
}

export default function NotesPage() {
  const params = useParams()
  const storyId = params.id as string
  const { stories, getCanvasData, saveCanvasData } = useStoryStore()
  const story = stories.find((s) => s.id === storyId)

  // Canvas navigation state
  const [currentCanvasId, setCurrentCanvasId] = useState("main")
  const [canvasPath, setCanvasPath] = useState<CanvasPath[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentFolderTitle, setCurrentFolderTitle] = useState<string | null>(null)

  // Get the default template (Story Planner Template)
  const defaultTemplate = useMemo(() => {
    return storyTemplates.find(t => t.id === 'basic') || storyTemplates[0]
  }, [])

  // Helper to get template for a sub-canvas based on canvas ID
  // Uses simple includes() checks like storycanvas does
  const getTemplateForCanvasId = useCallback((canvasId: string): { nodes: any[]; connections: any[] } | null => {
    if (canvasId === "main") {
      return { nodes: defaultTemplate.nodes, connections: defaultTemplate.connections }
    }

    // Generate unique IDs with timestamp to prevent duplicates
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 9)

    // Helper to apply unique IDs to template nodes
    const applyUniqueIds = (template: { nodes: any[]; connections: any[] }) => {
      const idMap: Record<string, string> = {}
      template.nodes.forEach(node => {
        idMap[node.id] = `${node.id}-${timestamp}-${randomSuffix}`
      })

      return {
        nodes: template.nodes.map(node => ({
          ...node,
          id: idMap[node.id],
          ...(node.childIds ? { childIds: node.childIds.map((childId: string) => idMap[childId] || childId) } : {}),
          ...(node.parentId ? { parentId: idMap[node.parentId] || node.parentId } : {}),
          ...(node.linkedCanvasId ? { linkedCanvasId: `${node.linkedCanvasId}-${timestamp}` } : {})
        })),
        connections: template.connections.map(conn => ({
          ...conn,
          id: `${conn.id}-${timestamp}-${randomSuffix}`,
          from: idMap[conn.from] || conn.from,
          to: idMap[conn.to] || conn.to
        }))
      }
    }

    // Check for characters-folder template
    if (canvasId.includes('characters-folder') && subCanvasTemplates['characters-folder']) {
      console.log('✅ Applying Characters & Relationships folder template')
      return applyUniqueIds(subCanvasTemplates['characters-folder'])
    }

    // Check for plot-folder template
    if (canvasId.includes('plot-folder') && subCanvasTemplates['plot-folder']) {
      console.log('✅ Applying Plot Structure & Events folder template')
      return applyUniqueIds(subCanvasTemplates['plot-folder'])
    }

    // Check for world-folder template
    if (canvasId.includes('world-folder') && subCanvasTemplates['world-folder']) {
      console.log('✅ Applying World & Settings folder template')
      return applyUniqueIds(subCanvasTemplates['world-folder'])
    }

    // Check for timeline-folder template
    if (canvasId.includes('timeline-folder') && subCanvasTemplates['folder-canvas-timeline-folder']) {
      console.log('✅ Applying Timeline folder template')
      return applyUniqueIds(subCanvasTemplates['folder-canvas-timeline-folder'])
    }

    // Check for character node template (individual character)
    if (canvasId.includes('character-') && subCanvasTemplates.character) {
      console.log('✅ Applying character template')
      return applyUniqueIds(subCanvasTemplates.character)
    }

    // Check for location template
    if (canvasId.includes('location-') && subCanvasTemplates.location) {
      console.log('✅ Applying location template')
      return applyUniqueIds(subCanvasTemplates.location)
    }

    // Check for country template
    if (canvasId.includes('country-') && subCanvasTemplates['country']) {
      console.log('✅ Applying country template')
      return applyUniqueIds(subCanvasTemplates['country'])
    }

    // Check for event template
    if (canvasId.includes('event-canvas-') && subCanvasTemplates.event) {
      console.log('✅ Applying event template')
      return applyUniqueIds(subCanvasTemplates.event)
    }

    // Check if it's an explicitly named template
    if (subCanvasTemplates[canvasId]) {
      console.log('✅ Applying explicit template:', canvasId)
      return applyUniqueIds(subCanvasTemplates[canvasId])
    }

    console.log('No template found for canvas:', canvasId)
    return null
  }, [defaultTemplate])

  // Get canvas data for current canvas
  const canvasData = getCanvasData(storyId, currentCanvasId)

  // Use template nodes if no saved data exists
  const initialNodes = useMemo(() => {
    if (canvasData?.nodes && canvasData.nodes.length > 0) {
      return canvasData.nodes
    }
    // Try to get template for this canvas
    const template = getTemplateForCanvasId(currentCanvasId)
    return template?.nodes || []
  }, [canvasData?.nodes, currentCanvasId, getTemplateForCanvasId])

  const initialConnections = useMemo(() => {
    if (canvasData?.connections && canvasData.connections.length > 0) {
      return canvasData.connections
    }
    // Try to get template for this canvas
    const template = getTemplateForCanvasId(currentCanvasId)
    return template?.connections || []
  }, [canvasData?.connections, currentCanvasId, getTemplateForCanvasId])

  // Initialize all sub-canvases from template when story is first loaded
  useEffect(() => {
    // Only run for main canvas when there's no saved data (first time loading)
    const mainCanvasData = getCanvasData(storyId, "main")
    if (mainCanvasData?.nodes && mainCanvasData.nodes.length > 0) {
      return // Already has saved data, don't overwrite
    }

    // Save the main canvas with template data
    saveCanvasData(storyId, "main", defaultTemplate.nodes, defaultTemplate.connections)

    // Helper function to get template for a node
    const getTemplateForNode = (node: any): { nodes: any[]; connections: any[] } | null => {
      // Check by node ID first (for specific folder templates)
      if (subCanvasTemplates[node.id]) {
        return subCanvasTemplates[node.id]
      }
      // Check by node type (for generic type templates)
      if (subCanvasTemplates[node.type]) {
        return subCanvasTemplates[node.type]
      }
      // Special case: location nodes can use 'country' template
      if (node.type === 'location' && subCanvasTemplates['country']) {
        return subCanvasTemplates['country']
      }
      return null
    }

    // Helper function to get canvas ID for a node
    const getCanvasIdForNode = (node: any): string => {
      if (node.linkedCanvasId) return node.linkedCanvasId
      const prefixes: Record<string, string> = {
        'folder': 'folder-canvas',
        'character': 'character-canvas',
        'location': 'location-canvas',
        'event': 'event-canvas',
      }
      const prefix = prefixes[node.type] || 'canvas'
      return `${prefix}-${node.id}`
    }

    // Expandable node types
    const expandableTypes = ['folder', 'character', 'location', 'event']

    // Helper function to recursively save sub-canvas templates
    const saveSubCanvases = (nodes: any[]) => {
      if (!nodes || !Array.isArray(nodes)) return
      nodes.forEach((node: any) => {
        if (!expandableTypes.includes(node.type)) return

        const template = getTemplateForNode(node)
        if (template && template.nodes.length > 0) {
          const canvasId = getCanvasIdForNode(node)
          saveCanvasData(storyId, canvasId, template.nodes, template.connections)
          // Recursively process nested nodes
          saveSubCanvases(template.nodes)
        }
      })
    }

    // Save all sub-canvases from the main template
    saveSubCanvases(defaultTemplate.nodes)

    // Also save explicitly named sub-canvas templates (like folder-canvas-timeline-folder)
    Object.keys(subCanvasTemplates).forEach((key) => {
      if (key.includes('-canvas-')) {
        const template = subCanvasTemplates[key]
        if (template.nodes.length > 0) {
          saveCanvasData(storyId, key, template.nodes, template.connections)
          // Recursively process nested nodes
          saveSubCanvases(template.nodes)
        }
      }
    })
  }, [storyId, getCanvasData, saveCanvasData, defaultTemplate])

  // Save handler
  const handleSave = useCallback(
    (nodes: any[], connections: any[]) => {
      saveCanvasData(storyId, currentCanvasId, nodes, connections)
    },
    [storyId, currentCanvasId, saveCanvasData]
  )

  // Navigate to a linked canvas (folder/event interior)
  const handleNavigateToCanvas = useCallback(
    (canvasId: string, nodeTitle: string) => {
      // Check if already at this canvas (prevent duplicates)
      if (currentCanvasId === canvasId) {
        return
      }

      // Add TARGET canvas to path for breadcrumbs (only if not already in path)
      const alreadyInPath = canvasPath.some(item => item.id === canvasId)
      const newPath = alreadyInPath ? canvasPath : [...canvasPath, { id: canvasId, title: nodeTitle }]
      setCanvasPath(newPath)

      setCurrentCanvasId(canvasId)
      setCurrentFolderId(canvasId)
      setCurrentFolderTitle(nodeTitle)
    },
    [currentCanvasId, canvasPath]
  )

  // Navigate back via breadcrumb
  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      if (index === -1) {
        // Go to main canvas
        setCurrentCanvasId("main")
        setCanvasPath([])
        setCurrentFolderId(null)
        setCurrentFolderTitle(null)
      } else if (index === canvasPath.length - 1) {
        // Already at this location, do nothing
        return
      } else {
        // Go to specific canvas in path
        const targetPath = canvasPath[index]
        setCurrentCanvasId(targetPath.id)
        // Keep path up to and including clicked item
        setCanvasPath((prev) => prev.slice(0, index + 1))
        setCurrentFolderId(targetPath.id)
        setCurrentFolderTitle(targetPath.title)
      }
    },
    [canvasPath]
  )

  // State change handler (for auto-save or tracking unsaved changes)
  const handleStateChange = useCallback(
    (nodes: any[], connections: any[]) => {
      // For now, just save on every change (simple persistence)
      saveCanvasData(storyId, currentCanvasId, nodes, connections)
    },
    [storyId, currentCanvasId, saveCanvasData]
  )

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-sky-400" />

            {/* Breadcrumb navigation */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => handleBreadcrumbClick(-1)}
                className={`text-sm font-medium transition-colors ${
                  currentCanvasId === "main"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {story?.title || "Notes"}
              </button>

              {canvasPath.map((pathItem, index) => (
                <div key={pathItem.id} className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`text-sm font-medium transition-colors ${
                      index === canvasPath.length - 1
                        ? "text-foreground cursor-default"
                        : "text-muted-foreground hover:text-foreground cursor-pointer"
                    }`}
                  >
                    {pathItem.title}
                  </button>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Upload className="w-4 h-4 mr-2" />
              Upload Master Doc
            </Button>
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden">
        <ColorProvider projectId={storyId}>
          <HTMLCanvas
            key={currentCanvasId} // Force remount when canvas changes
            storyId={storyId}
            currentCanvasId={currentCanvasId}
            canvasPath={canvasPath}
            currentFolderId={currentFolderId}
            currentFolderTitle={currentFolderTitle}
            initialNodes={initialNodes as any}
            initialConnections={initialConnections as any}
            onSave={handleSave}
            onNavigateToCanvas={handleNavigateToCanvas}
            onStateChange={handleStateChange}
            eventDepth={canvasPath.filter(item => item.id.startsWith('event-canvas-')).length}
          />
        </ColorProvider>
      </div>
    </div>
  )
}
