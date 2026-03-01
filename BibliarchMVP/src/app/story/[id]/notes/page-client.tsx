"use client"

import { useParams } from "next/navigation"
import { FileText, Upload, ChevronRight, Home, BookOpen, Trash2, X, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useStoryStore } from "@/stores/storyStore"
import { ColorProvider } from "@/components/providers/color-provider"
import { storyTemplates, subCanvasTemplates } from "@/lib/templates"
import dynamic from "next/dynamic"
import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import type { MasterDoc } from "@/types/story"

// Dynamically import HTMLCanvas to avoid SSR issues with canvas/DOM operations
const HTMLCanvas = dynamic(
  () => import("@/components/canvas/HTMLCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-200/60">Loading canvas...</p>
        </div>
      </div>
    )
  }
)

interface CanvasPath {
  id: string
  title: string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function NotesPage() {
  const params = useParams()
  const storyId = params.id as string
  const { stories, getCanvasData, saveCanvasData, masterDocs, addMasterDoc, deleteMasterDoc } = useStoryStore()
  const story = stories.find((s) => s.id === storyId)

  // Canvas navigation state
  const [currentCanvasId, setCurrentCanvasId] = useState("main")
  const [canvasPath, setCanvasPath] = useState<CanvasPath[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentFolderTitle, setCurrentFolderTitle] = useState<string | null>(null)

  // Master doc state
  const [showMasterDocsDialog, setShowMasterDocsDialog] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<MasterDoc | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const storyMasterDocs = masterDocs[storyId] || []

  // Get the default template (Story Planner Template)
  const defaultTemplate = useMemo(() => {
    return storyTemplates.find(t => t.id === 'basic') || storyTemplates[0]
  }, [])

  // Helper to get template for a sub-canvas based on canvas ID
  const getTemplateForCanvasId = useCallback((canvasId: string): { nodes: any[]; connections: any[] } | null => {
    if (canvasId === "main") {
      return { nodes: defaultTemplate.nodes, connections: defaultTemplate.connections }
    }

    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 9)

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

    if (canvasId.includes('characters-folder') && subCanvasTemplates['characters-folder']) {
      return applyUniqueIds(subCanvasTemplates['characters-folder'])
    }
    if (canvasId.includes('plot-folder') && subCanvasTemplates['plot-folder']) {
      return applyUniqueIds(subCanvasTemplates['plot-folder'])
    }
    if (canvasId.includes('world-folder') && subCanvasTemplates['world-folder']) {
      return applyUniqueIds(subCanvasTemplates['world-folder'])
    }
    if (canvasId.includes('timeline-folder') && subCanvasTemplates['folder-canvas-timeline-folder']) {
      return applyUniqueIds(subCanvasTemplates['folder-canvas-timeline-folder'])
    }
    if (canvasId.includes('character-') && subCanvasTemplates.character) {
      return applyUniqueIds(subCanvasTemplates.character)
    }
    if (canvasId.includes('location-') && subCanvasTemplates.location) {
      return applyUniqueIds(subCanvasTemplates.location)
    }
    if (canvasId.includes('country-') && subCanvasTemplates['country']) {
      return applyUniqueIds(subCanvasTemplates['country'])
    }
    if (canvasId.includes('event-canvas-') && subCanvasTemplates.event) {
      return applyUniqueIds(subCanvasTemplates.event)
    }
    if (subCanvasTemplates[canvasId]) {
      return applyUniqueIds(subCanvasTemplates[canvasId])
    }

    return null
  }, [defaultTemplate])

  // Get canvas data for current canvas
  const canvasData = getCanvasData(storyId, currentCanvasId)

  const initialNodes = useMemo(() => {
    if (canvasData?.nodes && canvasData.nodes.length > 0) {
      return canvasData.nodes
    }
    const template = getTemplateForCanvasId(currentCanvasId)
    return template?.nodes || []
  }, [canvasData?.nodes, currentCanvasId, getTemplateForCanvasId])

  const initialConnections = useMemo(() => {
    if (canvasData?.connections && canvasData.connections.length > 0) {
      return canvasData.connections
    }
    const template = getTemplateForCanvasId(currentCanvasId)
    return template?.connections || []
  }, [canvasData?.connections, currentCanvasId, getTemplateForCanvasId])

  // Initialize sub-canvases from template when story is first loaded
  useEffect(() => {
    const mainCanvasData = getCanvasData(storyId, "main")
    if (mainCanvasData?.nodes && mainCanvasData.nodes.length > 0) {
      return
    }

    saveCanvasData(storyId, "main", defaultTemplate.nodes, defaultTemplate.connections)

    const getTemplateForNode = (node: any): { nodes: any[]; connections: any[] } | null => {
      if (subCanvasTemplates[node.id]) return subCanvasTemplates[node.id]
      if (subCanvasTemplates[node.type]) return subCanvasTemplates[node.type]
      if (node.type === 'location' && subCanvasTemplates['country']) return subCanvasTemplates['country']
      return null
    }

    const getCanvasIdForNode = (node: any): string => {
      if (node.linkedCanvasId) return node.linkedCanvasId
      const prefixes: Record<string, string> = { 'folder': 'folder-canvas', 'character': 'character-canvas', 'location': 'location-canvas', 'event': 'event-canvas' }
      const prefix = prefixes[node.type] || 'canvas'
      return `${prefix}-${node.id}`
    }

    const expandableTypes = ['folder', 'character', 'location', 'event']
    const visited = new Set<string>()
    const saveSubCanvases = (nodes: any[]) => {
      if (!nodes || !Array.isArray(nodes)) return
      nodes.forEach((node: any) => {
        if (!expandableTypes.includes(node.type)) return
        const template = getTemplateForNode(node)
        if (template && template.nodes.length > 0) {
          const canvasId = getCanvasIdForNode(node)
          if (visited.has(canvasId)) return
          visited.add(canvasId)
          saveCanvasData(storyId, canvasId, template.nodes, template.connections)
          saveSubCanvases(template.nodes)
        }
      })
    }

    saveSubCanvases(defaultTemplate.nodes)

    Object.keys(subCanvasTemplates).forEach((key) => {
      if (key.includes('-canvas-')) {
        const template = subCanvasTemplates[key]
        if (template.nodes.length > 0) {
          saveCanvasData(storyId, key, template.nodes, template.connections)
          saveSubCanvases(template.nodes)
        }
      }
    })
  }, [storyId, getCanvasData, saveCanvasData, defaultTemplate])

  const handleSave = useCallback(
    (nodes: any[], connections: any[]) => {
      saveCanvasData(storyId, currentCanvasId, nodes, connections)
    },
    [storyId, currentCanvasId, saveCanvasData]
  )

  const handleNavigateToCanvas = useCallback(
    (canvasId: string, nodeTitle: string) => {
      if (currentCanvasId === canvasId) return
      const alreadyInPath = canvasPath.some(item => item.id === canvasId)
      const newPath = alreadyInPath ? canvasPath : [...canvasPath, { id: canvasId, title: nodeTitle }]
      setCanvasPath(newPath)
      setCurrentCanvasId(canvasId)
      setCurrentFolderId(canvasId)
      setCurrentFolderTitle(nodeTitle)
    },
    [currentCanvasId, canvasPath]
  )

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      if (index === -1) {
        setCurrentCanvasId("main")
        setCanvasPath([])
        setCurrentFolderId(null)
        setCurrentFolderTitle(null)
      } else if (index === canvasPath.length - 1) {
        return
      } else {
        const targetPath = canvasPath[index]
        setCurrentCanvasId(targetPath.id)
        setCanvasPath((prev) => prev.slice(0, index + 1))
        setCurrentFolderId(targetPath.id)
        setCurrentFolderTitle(targetPath.title)
      }
    },
    [canvasPath]
  )

  const handleStateChange = useCallback(
    (nodes: any[], connections: any[]) => {
      saveCanvasData(storyId, currentCanvasId, nodes, connections)
    },
    [storyId, currentCanvasId, saveCanvasData]
  )

  // Master doc upload handler
  const handleMasterDocUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      let content = e.target?.result as string
      if (!content) return

      // For .docx, strip XML tags (basic extraction)
      if (file.name.endsWith('.docx')) {
        content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }

      const doc: MasterDoc = {
        id: generateId(),
        storyId,
        filename: file.name,
        content,
        uploadedAt: new Date(),
      }
      addMasterDoc(storyId, doc)
    }
    reader.readAsText(file)
  }, [storyId, addMasterDoc])

  const handleDeleteMasterDoc = useCallback((docId: string) => {
    if (confirm('Delete this master document? This cannot be undone.')) {
      deleteMasterDoc(storyId, docId)
      if (viewingDoc?.id === docId) setViewingDoc(null)
    }
  }, [storyId, deleteMasterDoc, viewingDoc])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-sm pl-20 pr-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-600/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-sky-400" />
            </div>

            {/* Breadcrumb navigation */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => handleBreadcrumbClick(-1)}
                className={`text-sm font-medium transition-colors ${
                  currentCanvasId === "main"
                    ? "text-slate-200"
                    : "text-slate-200/60 hover:text-slate-200"
                }`}
              >
                {story?.title || "Notes"}
              </button>

              {canvasPath.map((pathItem, index) => (
                <div key={pathItem.id} className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-slate-200/40" />
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`text-sm font-medium transition-colors ${
                      index === canvasPath.length - 1
                        ? "text-slate-200 cursor-default"
                        : "text-slate-200/60 hover:text-slate-200 cursor-pointer"
                    }`}
                  >
                    {pathItem.title}
                  </button>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMasterDocsDialog(true)}
              className="bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-200"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Master Docs ({storyMasterDocs.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-200"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Master Doc
            </Button>
            <input
              type="file"
              accept=".md,.txt,.docx"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleMasterDocUpload(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden">
        <ColorProvider projectId={storyId}>
          <HTMLCanvas
            key={currentCanvasId}
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

      {/* Master Docs Browsing Dialog */}
      <Dialog open={showMasterDocsDialog} onOpenChange={setShowMasterDocsDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-400" />
              Master Documents
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Uploaded reference documents for this story.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {viewingDoc ? (
              /* Viewing a specific document */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setViewingDoc(null)}
                    className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <ChevronRight className="w-3 h-3 rotate-180" />
                    Back to list
                  </button>
                  <span className="text-xs text-slate-500">{viewingDoc.filename}</span>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed">
                  {viewingDoc.content}
                </div>
              </div>
            ) : storyMasterDocs.length === 0 ? (
              <div className="text-center py-8">
                <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No master documents uploaded yet.</p>
                <p className="text-slate-500 text-sm mt-1">Upload .md, .txt, or .docx files as reference material.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {storyMasterDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-slate-200 truncate">{doc.filename}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {doc.content.slice(0, 200)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 rounded transition-colors"
                        title="View document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMasterDoc(doc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
