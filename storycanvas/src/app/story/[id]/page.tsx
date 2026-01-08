'use client'

import React, { useEffect, useState, use, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Sparkles, ChevronRight, Settings, LogOut, Home as HomeIcon, ChevronLeft, Plus, Minus, RotateCcw, Bitcoin, Save, Cloud, CloudOff, Loader2, Download, Users, Wifi } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useColorContext } from '@/components/providers/color-provider'
import { subCanvasTemplates } from '@/lib/templates'
import FeedbackButton from '@/components/feedback/FeedbackButton'
import { signOut } from '@/lib/auth/actions'
import { useUser, useProfile, useStory, useCanvas, useUpdateStory, useSaveCanvas, queryKeys } from '@/lib/hooks/useSupabaseQuery'
import { useQueryClient } from '@tanstack/react-query'
import { ExportDialog } from '@/components/export/ExportDialog'
import { ShareDialog } from '@/components/collaboration/ShareDialog'
import { useStoryAccess, useRealtimeCanvas, usePresence, useStoryCoordination, ConnectionStatus, LockedNode } from '@/lib/hooks/useCollaboration'

// Use the HTML canvas instead to avoid Jest worker issues completely
const Bibliarch = dynamic(
  () => import('@/components/canvas/HTMLCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-sky-600 dark:text-blue-400 animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading canvas...</p>
        </div>
      </div>
    )
  }
)

interface PageProps {
  params: Promise<{ id: string }>
}

export default function StoryPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const colorContext = useColorContext()
  const router = useRouter()
  const supabase = createClient()

  // State must come before conditional hooks
  const [currentCanvasId, setCurrentCanvasId] = useState('main')
  const [canvasData, setCanvasData] = useState<any>(null)
  const [remoteUpdate, setRemoteUpdate] = useState<{ nodes: any[], connections: any[] } | null>(null)
  const [lockedNodes, setLockedNodes] = useState<Record<string, LockedNode>>({})
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false)
  const [canvasPath, setCanvasPath] = useState<{id: string, title: string}[]>([])
  const [showCanvasSettings, setShowCanvasSettings] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedBio, setEditedBio] = useState('')
  const [zoom, setZoom] = useState(1)
  const [headerTooltip, setHeaderTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Use cached queries - all called unconditionally
  const queryClient = useQueryClient()
  const { data: user, isLoading: isUserLoading } = useUser()
  const { data: profile } = useProfile(user?.id)
  const { data: story, isLoading: isStoryLoading } = useStory(resolvedParams.id)
  const { data: storyAccess } = useStoryAccess(resolvedParams.id)
  const { data: canvasDataFromQuery, isLoading: isCanvasLoading } = useCanvas(resolvedParams.id, currentCanvasId)
  const updateStoryMutation = useUpdateStory()
  const saveCanvasMutation = useSaveCanvas()

  const username = profile?.username || 'Storyteller'
  const isLoading = isUserLoading || isStoryLoading

  // Store the latest canvas state from Bibliarch component
  const latestCanvasData = useRef<{ nodes: any[], connections: any[] }>({ nodes: [], connections: [] })

  // CRITICAL: Track which canvas the latestCanvasData belongs to
  // This prevents saving wrong canvas data during rapid navigation
  const latestCanvasDataId = useRef<string>(currentCanvasId)

  // Store current palette for saving
  const currentPaletteRef = useRef<any>(null)

  // Function to save palette to database immediately
  const savePaletteToDatabase = useCallback(async (palette: any) => {
    if (!user?.id) return

    currentPaletteRef.current = palette
    const { nodes, connections } = latestCanvasData.current

    console.log('🎨 Saving palette to database:', palette?.name || palette?.id)

    await saveCanvasMutation.mutateAsync({
      storyId: resolvedParams.id,
      canvasType: currentCanvasId,
      nodes: nodes.length > 0 ? nodes : [],
      connections: connections.length > 0 ? connections : [],
      palette
    })
  }, [resolvedParams.id, currentCanvasId, user?.id, saveCanvasMutation])

  // Track if we're currently applying remote changes (to avoid save loops)
  const isApplyingRemoteChange = useRef(false)

  // Handle remote canvas changes from other collaborators
  const handleRemoteCanvasChange = useCallback((data: { nodes: any[]; connections: any[]; userId: string }) => {
    // Don't process changes while we're applying one
    if (isApplyingRemoteChange.current) return

    console.log(`📡 [RECEIVE] Received remote canvas change: ${data.nodes.length} nodes, ${data.connections.length} connections on canvas: ${currentCanvasIdRef.current}`)
    console.log(`📡 [RECEIVE] Current local data before applying: ${latestCanvasData.current.nodes.length} nodes`)

    // CRITICAL SAFETY: Reject empty broadcasts during canvas transitions
    // When User B enters a canvas, they briefly have empty state before loading from DB
    // If they broadcast during this window, User A would receive empty data
    // Only accept empty data if we're also empty (both users entering fresh) or during normal operation
    if (data.nodes.length === 0 && latestCanvasData.current.nodes.length > 0 && isCanvasTransition.current) {
      console.warn(`🛑 [RECEIVE] REJECTED empty canvas data during transition - protecting existing ${latestCanvasData.current.nodes.length} nodes`)
      console.warn(`🛑 [RECEIVE] Remote userId: ${data.userId}, current canvas: ${currentCanvasIdRef.current}`)
      return // Don't apply empty data during transitions
    }

    // Log warning for other suspicious empty data
    if (data.nodes.length === 0 && latestCanvasData.current.nodes.length > 0) {
      console.warn(`⚠️ [RECEIVE] Receiving empty canvas data while we have ${latestCanvasData.current.nodes.length} nodes`)
      console.warn(`⚠️ [RECEIVE] Remote userId: ${data.userId}, current canvas: ${currentCanvasIdRef.current}`)
    }

    isApplyingRemoteChange.current = true

    // Update remote state - full replacement for now (node-level merging can be added later)
    setRemoteUpdate({
      nodes: data.nodes,
      connections: data.connections
    })
    latestCanvasData.current = { nodes: data.nodes, connections: data.connections }

    // Reset flag after a short delay
    setTimeout(() => {
      isApplyingRemoteChange.current = false
    }, 100)
  }, [])

  // Handle node lock from other collaborators
  const handleNodeLock = useCallback((data: LockedNode) => {
    console.log('🔒 Node locked by', data.username, ':', data.nodeId)
    setLockedNodes(prev => ({
      ...prev,
      [data.nodeId]: data
    }))
  }, [])

  // Handle node unlock from other collaborators
  const handleNodeUnlock = useCallback((data: { nodeId: string; odataUserId: string }) => {
    console.log('🔓 Node unlocked:', data.nodeId)
    setLockedNodes(prev => {
      const newLocked = { ...prev }
      delete newLocked[data.nodeId]
      return newLocked
    })
  }, [])

  // Subscribe to presence (who's online)
  const { presenceState } = usePresence(
    resolvedParams.id,
    currentCanvasId,
    username
  )

  // Ref to store the save function so handleSaveRequest can access it
  const handleSaveCanvasRef = useRef<((nodes: any[], connections: any[]) => Promise<void>) | null>(null)

  // Handle save request from collaborators (when they navigate, they ask us to save)
  const handleSaveRequest = useCallback(() => {
    console.log('💾 [PAGE] handleSaveRequest called!')
    console.log('💾 [PAGE] latestCanvasData exists:', !!latestCanvasData.current)
    console.log('💾 [PAGE] handleSaveCanvasRef.current exists:', !!handleSaveCanvasRef.current)

    // Always save when requested, even if hasUnsavedChanges is false
    // This ensures collaborators get the latest state when navigating
    if (latestCanvasData.current && handleSaveCanvasRef.current) {
      console.log('💾 [PAGE] Saving current canvas - nodes:', latestCanvasData.current.nodes.length, 'connections:', latestCanvasData.current.connections.length)
      handleSaveCanvasRef.current(latestCanvasData.current.nodes, latestCanvasData.current.connections)
        .then(() => {
          hasUnsavedChanges.current = false
          console.log('💾 [PAGE] Save completed successfully from remote request')
        })
        .catch(err => {
          console.error('💾 [PAGE] Failed to save on remote request:', err)
        })
    } else {
      console.warn('💾 [PAGE] Cannot save - no data or save function not ready')
      console.warn('💾 [PAGE] latestCanvasData.current:', latestCanvasData.current)
      console.warn('💾 [PAGE] handleSaveCanvasRef.current:', handleSaveCanvasRef.current)
    }
  }, [])

  // Subscribe to realtime canvas changes (always broadcasts when connected)
  const { broadcastChange, broadcastNodeLock, broadcastNodeUnlock, connectionStatus } = useRealtimeCanvas(
    resolvedParams.id,
    currentCanvasId,
    handleRemoteCanvasChange,
    handleNodeLock,
    handleNodeUnlock
  )

  // Subscribe to story-level coordination (for save requests that reach ALL users)
  console.log('🔧 [PAGE] About to call useStoryCoordination with storyId:', resolvedParams.id)
  const { broadcastSaveRequest } = useStoryCoordination(
    resolvedParams.id,
    handleSaveRequest
  )
  console.log('🔧 [PAGE] useStoryCoordination returned broadcastSaveRequest:', !!broadcastSaveRequest)

  // Viewer mode disabled for now - causes sync issues
  const isViewer = false

  // Auto-unlock nodes when users leave (presence change)
  useEffect(() => {
    // Get list of online user IDs
    const onlineUserIds = new Set(Object.keys(presenceState))

    // Remove locks for users who are no longer present
    setLockedNodes(prev => {
      const newLocked: Record<string, LockedNode> = {}
      for (const [nodeId, lock] of Object.entries(prev)) {
        if (onlineUserIds.has(lock.odataUserId)) {
          // User is still online, keep the lock
          newLocked[nodeId] = lock
        } else {
          console.log('🔓 Auto-unlocking node (user left):', nodeId)
        }
      }
      return newLocked
    })
  }, [presenceState])

  // Set project context for color palette persistence
  useEffect(() => {
    colorContext.setCurrentProjectId(resolvedParams.id)
  }, [resolvedParams.id])

  // Set folder context for folder-specific palettes
  useEffect(() => {
    // If we're in a folder (not main canvas), set folder context
    const folderId = currentCanvasId !== 'main' ? currentCanvasId : null
    colorContext.setCurrentFolderId(folderId)

    // Apply folder palette if exists, otherwise use project palette
    if (folderId) {
      const folderPalette = colorContext.getFolderPalette(folderId)
      if (folderPalette) {
        colorContext.applyPalette(folderPalette)
      } else {
        // Apply project palette if no folder palette exists
        const projectPalette = colorContext.getCurrentPalette()
        if (projectPalette) {
          colorContext.applyPalette(projectPalette)
        }
      }
    } else {
      // We're on main canvas, use project palette
      const projectPalette = colorContext.getCurrentPalette()
      if (projectPalette) {
        colorContext.applyPalette(projectPalette)
      }
    }
  }, [currentCanvasId, colorContext])

  // Track current canvas ID to prevent stale closures
  const currentCanvasIdRef = useRef(currentCanvasId)
  useEffect(() => {
    currentCanvasIdRef.current = currentCanvasId
  }, [currentCanvasId])

  // Handle authentication redirects
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login')
    }
  }, [user, isUserLoading, router])

  // Update document title and form fields when story loads
  useEffect(() => {
    if (story?.title) {
      document.title = `${story.title} - Bibliarch`
      setEditedTitle(story.title)
      setEditedBio(story.bio || '')
    }
  }, [story?.title, story?.bio])

  // Apply canvas-page class to body to prevent scrolling
  useEffect(() => {
    document.body.classList.add('canvas-page')
    return () => {
      document.body.classList.remove('canvas-page')
    }
  }, [])

  // Track if we have unsaved changes
  const hasUnsavedChanges = useRef(false)
  const isSaving = useRef(false)
  const isInternalNavigation = useRef(false) // Track if navigation is internal (home button, etc.)
  const isCanvasTransition = useRef(false) // Track canvas transitions to prevent stale broadcasts
  const canvasTransitionTimeout = useRef<NodeJS.Timeout | null>(null) // Cleanup ref for transition timeout

  // Cleanup canvas transition timeout on unmount
  useEffect(() => {
    return () => {
      if (canvasTransitionTimeout.current) {
        clearTimeout(canvasTransitionTimeout.current)
      }
    }
  }, [])

  // Handle canvas data loading from cache
  useEffect(() => {
    if (isCanvasLoading) {
      setIsLoadingCanvas(true)
      return
    }

    // CRITICAL: Only load data if it's for the canvas we're expecting
    // This prevents showing stale cached data during transitions
    const canvas = canvasDataFromQuery
    const dataCanvasId = canvas?.canvas_type || null

    // Check if we're in transition and this data is stale (from wrong canvas)
    if (isCanvasTransition.current && dataCanvasId !== currentCanvasId) {
      console.log('⏳ Canvas transition: ignoring stale data from', dataCanvasId, 'expecting', currentCanvasId)
      setIsLoadingCanvas(true)
      return
    }

    // If we're in transition and received correct data, transition is complete
    if (isCanvasTransition.current && dataCanvasId === currentCanvasId) {
      console.log('✅ Canvas transition complete: received fresh data for', currentCanvasId)
      isCanvasTransition.current = false
      if (canvasTransitionTimeout.current) {
        clearTimeout(canvasTransitionTimeout.current)
        canvasTransitionTimeout.current = null
      }
    }

    // Clear old data
    latestCanvasData.current = { nodes: [], connections: [] }
    latestCanvasDataId.current = currentCanvasId // Update to reflect current canvas
    setRemoteUpdate(null) // Clear remote updates when switching canvases

    if (canvas) {
      const loadedData = {
        nodes: canvas.nodes || [],
        connections: canvas.connections || []
      }

      // CRITICAL: Only apply template if canvas exists but is EMPTY
      // AND user is the owner (not a collaborator) to prevent loops
      const isOwner = storyAccess?.isOwner ?? false
      if (loadedData.nodes.length === 0 && isOwner) {
        // Check for characters-folder template
        if (currentCanvasId.includes('characters-folder') && subCanvasTemplates['characters-folder']) {
          console.log('✅ Applying Characters & Relationships folder template to empty canvas')
          const timestamp = Date.now()

          const idMap: Record<string, string> = {}
          subCanvasTemplates['characters-folder'].nodes.forEach(node => {
            idMap[node.id] = `${node.id}-${timestamp}`
          })

          const templateData = {
            nodes: subCanvasTemplates['characters-folder'].nodes.map(node => ({
              ...node,
              id: idMap[node.id],
              ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
              ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
            })),
            connections: subCanvasTemplates['characters-folder'].connections.map(conn => ({
              ...conn,
              id: `${conn.id}-${timestamp}`,
              from: idMap[conn.from] || conn.from,
              to: idMap[conn.to] || conn.to
            }))
          }

          setCanvasData(templateData)
          latestCanvasData.current = templateData

          // Save template immediately to prevent data loss
          handleSaveCanvas(templateData.nodes, templateData.connections)
        }
        // Check for character node template
        else if (currentCanvasId.includes('character-') && subCanvasTemplates.character) {
          console.log('✅ Applying character template to empty canvas')
          const timestamp = Date.now()

          const idMap: Record<string, string> = {}
          subCanvasTemplates.character.nodes.forEach(node => {
            idMap[node.id] = `${node.id}-${timestamp}`
          })

          const templateData = {
            nodes: subCanvasTemplates.character.nodes.map(node => ({
              ...node,
              id: idMap[node.id],
              ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
              ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
            })),
            connections: subCanvasTemplates.character.connections.map(conn => ({
              ...conn,
              id: `${conn.id}-${timestamp}`,
              from: idMap[conn.from] || conn.from,
              to: idMap[conn.to] || conn.to
            }))
          }

          setCanvasData(templateData)
          latestCanvasData.current = templateData

          // Save template immediately to prevent data loss
          handleSaveCanvas(templateData.nodes, templateData.connections)
        } else {
          setCanvasData(loadedData)
          latestCanvasData.current = loadedData
        }
      } else {
        setCanvasData(loadedData)
        latestCanvasData.current = loadedData
      }
    } else {
      // No existing canvas data - this is expected for new folder canvases
      console.log('No canvas data found for canvas:', currentCanvasId)

      // Check if this is a folder canvas that needs a template
      let templateData: { nodes: any[], connections: any[] } = { nodes: [], connections: [] }

      // Detect if this is a specific folder canvas by checking the canvas ID pattern
      console.log('🔍 Checking canvas ID for template:', currentCanvasId)
      console.log('🔍 Has characters-folder template?', !!subCanvasTemplates['characters-folder'])

      // For folder canvases, check if it needs a template FIRST
      if (currentCanvasId.includes('characters-folder') && subCanvasTemplates['characters-folder']) {
        console.log('✅ Applying Characters & Relationships folder template')
        const timestamp = Date.now()

        // Create ID mapping for updating references
        const idMap: Record<string, string> = {}
        subCanvasTemplates['characters-folder'].nodes.forEach(node => {
          idMap[node.id] = `${node.id}-${timestamp}`
        })

        templateData = {
          nodes: subCanvasTemplates['characters-folder'].nodes.map(node => ({
            ...node,
            id: idMap[node.id],
            // Update childIds to use new IDs
            ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
            // Update parentId to use new ID
            ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
          })),
          connections: subCanvasTemplates['characters-folder'].connections.map(conn => ({
            ...conn,
            id: `${conn.id}-${timestamp}`,
            from: idMap[conn.from] || conn.from,
            to: idMap[conn.to] || conn.to
          }))
        }
        console.log('📦 Template nodes created:', templateData.nodes.length)
        setCanvasData(templateData)
        latestCanvasData.current = templateData

        // Save template immediately
        handleSaveCanvas(templateData.nodes, templateData.connections)
      } else if (currentCanvasId.includes('plot-folder') && subCanvasTemplates['plot-folder']) {
        console.log('✅ Applying Plot Structure & Events folder template')
        const timestamp = Date.now()

        // Create ID mapping for updating references
        const idMap: Record<string, string> = {}
        subCanvasTemplates['plot-folder'].nodes.forEach(node => {
          idMap[node.id] = `${node.id}-${timestamp}`
        })

        templateData = {
          nodes: subCanvasTemplates['plot-folder'].nodes.map(node => ({
            ...node,
            id: idMap[node.id],
            // Update childIds to use new IDs
            ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
            // Update parentId to use new ID
            ...(node.parentId ? { parentId: idMap[node.parentId] } : {}),
            // Update linkedCanvasId for folder nodes
            ...(node.linkedCanvasId ? { linkedCanvasId: `${node.linkedCanvasId}-${timestamp}` } : {})
          })),
          connections: subCanvasTemplates['plot-folder'].connections.map(conn => ({
            ...conn,
            id: `${conn.id}-${timestamp}`,
            from: idMap[conn.from] || conn.from,
            to: idMap[conn.to] || conn.to
          }))
        }
        console.log('📦 Template nodes created:', templateData.nodes.length)
        setCanvasData(templateData)
        latestCanvasData.current = templateData

        // Save template immediately
        handleSaveCanvas(templateData.nodes, templateData.connections)
      } else if (currentCanvasId.includes('world-folder') && subCanvasTemplates['world-folder']) {
        console.log('✅ Applying World & Settings folder template', currentCanvasId)
        const timestamp = Date.now()

        // Create ID mapping for updating references
        const idMap: Record<string, string> = {}
        subCanvasTemplates['world-folder'].nodes.forEach(node => {
          idMap[node.id] = `${node.id}-${timestamp}`
        })

        templateData = {
          nodes: subCanvasTemplates['world-folder'].nodes.map(node => ({
            ...node,
            id: idMap[node.id],
            // Update childIds to use new IDs
            ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
            // Update parentId to use new ID
            ...(node.parentId ? { parentId: idMap[node.parentId] } : {}),
            // Update linkedCanvasId for folder nodes
            ...(node.linkedCanvasId ? { linkedCanvasId: `${node.linkedCanvasId}-${timestamp}` } : {})
          })),
          connections: subCanvasTemplates['world-folder'].connections.map(conn => ({
            ...conn,
            id: `${conn.id}-${timestamp}`,
            from: idMap[conn.from] || conn.from,
            to: idMap[conn.to] || conn.to
          }))
        }
        console.log('📦 Template nodes created:', templateData.nodes.length)
        setCanvasData(templateData)
        latestCanvasData.current = templateData

        // Save template immediately
        handleSaveCanvas(templateData.nodes, templateData.connections)
      } else if (currentCanvasId.includes('timeline-folder') && subCanvasTemplates['folder-canvas-timeline-folder']) {
        console.log('✅ Applying Timeline folder template')
        const timestamp = Date.now()

        // Create ID mapping for updating references
        const idMap: Record<string, string> = {}
        subCanvasTemplates['folder-canvas-timeline-folder'].nodes.forEach(node => {
          idMap[node.id] = `${node.id}-${timestamp}`
        })

        templateData = {
          nodes: subCanvasTemplates['folder-canvas-timeline-folder'].nodes.map(node => ({
            ...node,
            id: idMap[node.id],
            // Update childIds to use new IDs
            ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
            // Update parentId to use new ID
            ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
          })),
          connections: subCanvasTemplates['folder-canvas-timeline-folder'].connections.map(conn => ({
            ...conn,
            id: `${conn.id}-${timestamp}`,
            from: idMap[conn.from] || conn.from,
            to: idMap[conn.to] || conn.to
          }))
        }
        console.log('📦 Timeline template nodes created:', templateData.nodes.length)
        setCanvasData(templateData)
        latestCanvasData.current = templateData

        // Save template immediately
        handleSaveCanvas(templateData.nodes, templateData.connections)
      } else if (currentCanvasId.includes('country-') && subCanvasTemplates['country']) {
        console.log('✅ Applying Country template')
        const timestamp = Date.now()

        // Create ID mapping for updating references
        const idMap: Record<string, string> = {}
        subCanvasTemplates['country'].nodes.forEach(node => {
          idMap[node.id] = `${node.id}-${timestamp}`
        })

        templateData = {
          nodes: subCanvasTemplates['country'].nodes.map(node => ({
            ...node,
            id: idMap[node.id],
            // Update childIds to use new IDs
            ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
            // Update parentId to use new ID
            ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
          })),
          connections: subCanvasTemplates['country'].connections.map(conn => ({
            ...conn,
            id: `${conn.id}-${timestamp}`,
            from: idMap[conn.from] || conn.from,
            to: idMap[conn.to] || conn.to
          }))
        }
        console.log('📦 Template nodes created:', templateData.nodes.length)
        setCanvasData(templateData)
        latestCanvasData.current = templateData

        // Save template immediately
        handleSaveCanvas(templateData.nodes, templateData.connections)
      } else if (currentCanvasId.startsWith('folder-canvas-')) {
        console.log('Creating empty folder canvas (no template match)')
        const emptyData = { nodes: [], connections: [] }
        setCanvasData(emptyData)
        latestCanvasData.current = emptyData
      } else {
        // For main canvas only, check for other sub-canvas templates
        console.log('Checking for other templates...')

        if (currentCanvasId.includes('character-') && subCanvasTemplates.character) {
          console.log('Applying character sub-canvas template')
          const timestamp = Date.now()
          const randomSuffix = Math.random().toString(36).substring(2, 9)

          // Create ID mapping for updating references (with random suffix to prevent duplicates)
          const idMap: Record<string, string> = {}
          subCanvasTemplates.character.nodes.forEach(node => {
            idMap[node.id] = `${node.id}-${timestamp}-${randomSuffix}`
          })

          templateData = {
            nodes: subCanvasTemplates.character.nodes.map(node => ({
              ...node,
              id: idMap[node.id],
              ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
              ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
            })),
            connections: subCanvasTemplates.character.connections.map(conn => ({
              ...conn,
              id: `${conn.id}-${timestamp}-${randomSuffix}`,
              from: idMap[conn.from] || conn.from,
              to: idMap[conn.to] || conn.to
            }))
          }
        } else if (currentCanvasId.includes('location-') && subCanvasTemplates.location) {
          console.log('Applying location sub-canvas template')
          const timestamp = Date.now()
          const randomSuffix = Math.random().toString(36).substring(2, 9)

          // Create ID mapping for updating references (with random suffix to prevent duplicates)
          const idMap: Record<string, string> = {}
          subCanvasTemplates.location.nodes.forEach(node => {
            idMap[node.id] = `${node.id}-${timestamp}-${randomSuffix}`
          })

          templateData = {
            nodes: subCanvasTemplates.location.nodes.map(node => ({
              ...node,
              id: idMap[node.id],
              ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
              ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
            })),
            connections: subCanvasTemplates.location.connections.map(conn => ({
              ...conn,
              id: `${conn.id}-${timestamp}-${randomSuffix}`,
              from: idMap[conn.from] || conn.from,
              to: idMap[conn.to] || conn.to
            }))
          }
        } else if (currentCanvasId.includes('event-canvas-') && subCanvasTemplates.event) {
          console.log('Applying event sub-canvas template')
          const timestamp = Date.now()
          const randomSuffix = Math.random().toString(36).substring(2, 9)

          // Create ID mapping for updating references (with random suffix to prevent duplicates)
          const idMap: Record<string, string> = {}
          subCanvasTemplates.event.nodes.forEach(node => {
            idMap[node.id] = `${node.id}-${timestamp}-${randomSuffix}`
          })

          templateData = {
            nodes: subCanvasTemplates.event.nodes.map(node => ({
              ...node,
              id: idMap[node.id],
              ...(node.childIds ? { childIds: node.childIds.map(childId => idMap[childId]) } : {}),
              ...(node.parentId ? { parentId: idMap[node.parentId] } : {})
            })),
            connections: subCanvasTemplates.event.connections.map(conn => ({
              ...conn,
              id: `${conn.id}-${timestamp}-${randomSuffix}`,
              from: idMap[conn.from] || conn.from,
              to: idMap[conn.to] || conn.to
            }))
          }
        }

        console.log('Initializing canvas with template data:', templateData)
        setCanvasData(templateData)
        latestCanvasData.current = templateData

        // If we applied a template, save it immediately so it persists
        if (templateData.nodes.length > 0) {
          handleSaveCanvas(templateData.nodes, templateData.connections)
        }
      }
    }

    setIsLoadingCanvas(false)

    // Fallback: Reset canvas transition flag after a delay if not already reset
    // This ensures we don't get stuck in transition state if something goes wrong
    // Use 1000ms to account for save-request delay (500ms) + network latency
    if (isCanvasTransition.current) {
      if (canvasTransitionTimeout.current) {
        clearTimeout(canvasTransitionTimeout.current)
      }
      canvasTransitionTimeout.current = setTimeout(() => {
        if (isCanvasTransition.current) {
          console.log('⚠️ Canvas transition timeout - forcing completion')
          isCanvasTransition.current = false
        }
        canvasTransitionTimeout.current = null
      }, 1000)
    }
  }, [canvasDataFromQuery, isCanvasLoading, currentCanvasId, storyAccess?.isOwner])

  // Load and apply palette from database when canvas data is loaded
  useEffect(() => {
    if (canvasDataFromQuery?.palette && currentCanvasId === 'main') {
      console.log('🎨 Loading palette from database:', canvasDataFromQuery.palette?.name || canvasDataFromQuery.palette?.id)
      // Store in ref
      currentPaletteRef.current = canvasDataFromQuery.palette
      // Apply palette using color context
      colorContext.setProjectPalette(resolvedParams.id, canvasDataFromQuery.palette)
      colorContext.applyPalette(canvasDataFromQuery.palette)
    }
  }, [canvasDataFromQuery?.palette, currentCanvasId, resolvedParams.id])

  const handleSaveCanvas = useCallback(async (nodes: any[], connections: any[] = []) => {
    const saveToCanvasId = currentCanvasIdRef.current

    if (!user?.id) {
      console.warn('No user found, skipping save')
      return
    }

    // CRITICAL: Safety check to prevent overwriting main canvas with folder data
    // If we're about to save to main canvas but data looks suspiciously small, abort
    if (saveToCanvasId === 'main') {
      const existingMainData = latestCanvasData.current
      // If existing main canvas has data but we're trying to save very little, this is likely wrong
      if (existingMainData?.nodes?.length > 5 && nodes.length <= 2) {
        console.error('⚠️ PREVENTED DATA LOSS: Attempting to overwrite main canvas with suspiciously small data')
        console.error('Existing nodes:', existingMainData.nodes.length, 'New nodes:', nodes.length)
        return // Abort the save
      }
    }

    // Update the ref with latest data
    latestCanvasData.current = { nodes, connections }
    latestCanvasDataId.current = saveToCanvasId // Track which canvas this data belongs to

    console.log(`💾 Saving to canvas: ${saveToCanvasId}, nodes: ${nodes.length}, connections: ${connections.length}`)

    // Use mutateAsync to actually wait for save to complete before navigation
    await saveCanvasMutation.mutateAsync({
      storyId: resolvedParams.id,
      canvasType: saveToCanvasId,
      nodes,
      connections
    })
  }, [resolvedParams.id, user?.id, saveCanvasMutation])

  // Store handleSaveCanvas in ref so handleSaveRequest can access it
  useEffect(() => {
    handleSaveCanvasRef.current = handleSaveCanvas
  }, [handleSaveCanvas])

  // Handle state changes from canvas - broadcast to collaborators
  const handleStateChange = useCallback((nodes: any[], connections: any[]) => {
    // Update refs
    latestCanvasData.current = { nodes, connections }
    latestCanvasDataId.current = currentCanvasIdRef.current // Track which canvas this data belongs to
    hasUnsavedChanges.current = true

    // Skip broadcasting if we're applying remote changes (prevents echo)
    if (isApplyingRemoteChange.current) return

    // CRITICAL: Skip broadcasting while canvas is loading
    // When User B navigates, canvasData is set to null and isLoadingCanvas is true
    // During this time, the canvas mounts with empty initialNodes=[]
    // We must NOT broadcast this empty state to other users
    if (isLoadingCanvas) {
      console.log('📡 Skipping broadcast - canvas is still loading')
      return
    }

    // Skip broadcasting during canvas transitions to prevent stale data from old canvas
    // reaching collaborators on the new canvas channel
    if (isCanvasTransition.current) {
      console.log('📡 Skipping broadcast during canvas transition')
      return
    }

    // Log what we're about to broadcast
    console.log(`📡 [BROADCAST] About to broadcast: ${nodes.length} nodes, ${connections.length} connections on canvas: ${currentCanvasIdRef.current}`)

    // Broadcast to all collaborators
    if (broadcastChange) {
      broadcastChange(nodes, connections)
    }
  }, [broadcastChange, isLoadingCanvas])

  // Save function that can be called synchronously for browser navigation
  const saveBeforeUnload = useCallback(async () => {
    // Prevent concurrent saves
    if (isSaving.current) return
    if (!hasUnsavedChanges.current) return
    if (!user?.id) return

    isSaving.current = true

    try {
      const { nodes, connections } = latestCanvasData.current
      if (nodes.length > 0 || connections.length > 0) {
        console.log('💾 Browser navigation save triggered:', currentCanvasIdRef.current)
        await handleSaveCanvas(nodes, connections)
        hasUnsavedChanges.current = false
        console.log('✅ Browser navigation save completed')
      }
    } catch (error) {
      console.error('❌ Browser navigation save failed:', error)
    } finally {
      isSaving.current = false
    }
  }, [user?.id, handleSaveCanvas])

  // Handle browser back/forward/refresh/close
  useEffect(() => {
    // Save when page is about to unload (refresh, close, navigate away)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't interfere with internal navigation (home button, etc.)
      if (isInternalNavigation.current) {
        return
      }

      if (hasUnsavedChanges.current && !isSaving.current) {
        // Trigger save
        saveBeforeUnload()

        // Show browser warning for unsaved changes
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    // Save when tab becomes hidden (tab switch, minimize, etc.)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveBeforeUnload()
      }
    }

    // Handle browser back/forward button (Milanote's "2 clicks" trick)
    const handlePopState = (e: PopStateEvent) => {
      // Don't interfere with internal navigation (home button, etc.)
      if (isInternalNavigation.current) {
        isInternalNavigation.current = false
        return
      }

      // If we have unsaved changes, save them first
      if (hasUnsavedChanges.current) {
        e.preventDefault()

        // Save the data
        saveBeforeUnload().then(() => {
          // After save completes, allow navigation
          console.log('✅ Saved before browser navigation')
        })

        // Push the state back so user needs to click back again
        try {
          window.history.pushState({ bibliarch: true }, '', window.location.href)
        } catch (err) {
          // Some mobile browsers restrict pushState
          console.warn('pushState failed:', err)
        }
      }
    }

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('popstate', handlePopState)

    return () => {
      // Cleanup
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('popstate', handlePopState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveCanvasSettings() {
    if (!editedTitle.trim()) {
      alert('Project name cannot be empty')
      return
    }

    updateStoryMutation.mutate(
      {
        storyId: resolvedParams.id,
        title: editedTitle.trim(),
        bio: editedBio.trim()
      },
      {
        onSuccess: () => {
          setShowCanvasSettings(false)
        },
        onError: (error: any) => {
          console.error('Error saving canvas settings:', error)
          if (error.message?.includes('column') && error.message?.includes('bio')) {
            alert('The bio field needs to be added to your database. Please add a "bio" column (type: text) to the "stories" table in Supabase.')
          } else {
            alert(`Failed to save settings: ${error.message || 'Unknown error'}`)
          }
        }
      }
    )
  }


  // Navigate to nested canvas
  async function handleNavigateToCanvas(canvasId: string, nodeTitle: string) {
    // Check if already at this canvas (prevent duplicates)
    if (currentCanvasId === canvasId) {
      return
    }

    // COLLABORATION FIX: Ask all users to save before we navigate
    // This ensures when we come back, we'll see their changes
    console.log('💾 [NAVIGATION] About to broadcast save request to all collaborators')
    console.log('💾 [NAVIGATION] broadcastSaveRequest exists:', !!broadcastSaveRequest)
    if (broadcastSaveRequest) {
      broadcastSaveRequest()
    } else {
      console.error('💾 [NAVIGATION] broadcastSaveRequest is undefined!')
    }

    // Wait 500ms + random jitter for other users to save their changes
    // Jitter reduces exact collision probability when multiple users navigate simultaneously
    const jitter = Math.random() * 100 // 0-100ms random delay
    await new Promise(resolve => setTimeout(resolve, 500 + jitter))

    // SAVE CURRENT CANVAS FIRST! Use the latest data from the ref
    // CRITICAL: Validate that latestCanvasData actually belongs to the canvas we're leaving
    if (latestCanvasDataId.current === currentCanvasId &&
        (latestCanvasData.current.nodes.length > 0 || latestCanvasData.current.connections.length > 0)) {
      await handleSaveCanvas(latestCanvasData.current.nodes, latestCanvasData.current.connections)
      hasUnsavedChanges.current = false // Reset flag after successful save
      console.log('Saved canvas before navigation:', currentCanvasId, latestCanvasData.current)
    } else if (latestCanvasDataId.current !== currentCanvasId) {
      console.warn('⚠️ Skipping save - latestCanvasData belongs to', latestCanvasDataId.current, 'not', currentCanvasId)
    }

    // Add to path for breadcrumbs (only if not already in path)
    const alreadyInPath = canvasPath.some(item => item.id === canvasId)
    const newPath = alreadyInPath ? canvasPath : [...canvasPath, { id: canvasId, title: nodeTitle }]
    setCanvasPath(newPath)

    // CRITICAL FIX: Clear old canvas data BEFORE changing canvas ID
    // This prevents showing stale data from the previous canvas
    setCanvasData(null)
    setIsLoadingCanvas(true)

    // Invalidate cache for BOTH canvases:
    // 1. The canvas we're leaving (so it's fresh when we return)
    queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, currentCanvasId) })
    // 2. The canvas we're going to (so we see collaborators' latest changes)
    queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, canvasId) })
    console.log('🔄 Invalidated cache for both canvases:', currentCanvasId, 'and', canvasId)

    // Mark that we're in a canvas transition to prevent stale broadcasts
    isCanvasTransition.current = true

    // Now update canvas ID - the useEffect will load new data
    setCurrentCanvasId(canvasId)
  }


  // Navigate back
  async function handleNavigateBack() {
    if (canvasPath.length === 0) return

    // COLLABORATION FIX: Ask all users to save before we navigate
    // This ensures when we come back, we'll see their changes
    console.log('💾 Broadcasting save request to all collaborators before navigating back')
    broadcastSaveRequest()

    // Wait 500ms + random jitter for other users to save their changes
    // Jitter reduces exact collision probability when multiple users navigate simultaneously
    const jitter = Math.random() * 100 // 0-100ms random delay
    await new Promise(resolve => setTimeout(resolve, 500 + jitter))

    // SAVE CURRENT CANVAS FIRST!
    // CRITICAL: Validate that latestCanvasData actually belongs to the canvas we're leaving
    if (latestCanvasDataId.current === currentCanvasId &&
        (latestCanvasData.current.nodes.length > 0 || latestCanvasData.current.connections.length > 0)) {
      await handleSaveCanvas(latestCanvasData.current.nodes, latestCanvasData.current.connections)
      hasUnsavedChanges.current = false // Reset flag after successful save
      console.log('Saved canvas before navigating back:', currentCanvasId, latestCanvasData.current)
    } else if (latestCanvasDataId.current !== currentCanvasId) {
      console.warn('⚠️ Skipping save - latestCanvasData belongs to', latestCanvasDataId.current, 'not', currentCanvasId)
    }

    const newPath = [...canvasPath]
    newPath.pop() // Remove current location from path
    setCanvasPath(newPath)

    // CRITICAL FIX: Clear old canvas data BEFORE changing canvas ID
    // This prevents showing stale data from the previous canvas
    setCanvasData(null)
    setIsLoadingCanvas(true)

    // Calculate where we're going
    const previousLocation = newPath.length > 0 ? newPath[newPath.length - 1] : null
    const destinationCanvasId = previousLocation?.id || 'main'

    // Invalidate cache for BOTH canvases:
    // 1. The canvas we're leaving (so it's fresh when we return)
    queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, currentCanvasId) })
    // 2. The canvas we're going to (so we see collaborators' latest changes)
    queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, destinationCanvasId) })
    console.log('🔄 Invalidated cache for both canvases:', currentCanvasId, 'and', destinationCanvasId)

    // Mark that we're in a canvas transition to prevent stale broadcasts
    isCanvasTransition.current = true

    // Navigate to the previous location
    setCurrentCanvasId(destinationCanvasId)
  }

  // Move a node to the parent canvas
  async function handleMoveNodeToParent(node: any) {
    if (canvasPath.length === 0) return // Already at main canvas

    // Get the parent canvas ID
    const parentCanvasId = canvasPath.length > 1
      ? canvasPath[canvasPath.length - 2].id
      : 'main'

    console.log('Moving node to parent canvas:', node.id, 'from', currentCanvasId, 'to', parentCanvasId)
    console.log('Canvas path:', canvasPath)

    try {
      // Load parent canvas data - use maybeSingle to handle non-existent canvases gracefully
      const { data: parentCanvasData, error } = await supabase
        .from('canvas_data')
        .select('nodes, connections')
        .eq('story_id', resolvedParams.id)
        .eq('canvas_type', parentCanvasId)
        .maybeSingle()

      console.log('Parent canvas query result:', { data: parentCanvasData, error, parentCanvasId })

      if (error) {
        console.error('Error loading parent canvas:', error.message || error.code || JSON.stringify(error))
        return
      }

      // Add node to parent canvas with a new position
      const parentNodes = parentCanvasData?.nodes || []
      const nodeWithNewPosition = {
        ...node,
        x: 100 + Math.random() * 200, // Random position to avoid overlap
        y: 100 + Math.random() * 200,
      }

      const updatedParentNodes = [...parentNodes, nodeWithNewPosition]
      const parentConnections = parentCanvasData?.connections || []

      // Save parent canvas
      await saveCanvasMutation.mutateAsync({
        storyId: resolvedParams.id,
        canvasType: parentCanvasId,
        nodes: updatedParentNodes,
        connections: parentConnections,
      })

      console.log('Node moved to parent canvas successfully')
    } catch (err) {
      console.error('Failed to move node to parent:', err)
    }
  }

  // Move a node into a folder's canvas
  async function handleMoveNodeToFolder(node: any, folderId: string) {
    console.log('Moving node into folder:', node.id, 'to folder', folderId)

    try {
      // Determine the target canvas ID based on folder type
      // Folders use linkedCanvasId if it exists, otherwise construct from ID
      const folderNode = latestCanvasData.current.nodes.find((n: any) => n.id === folderId)
      console.log('Found folder node:', folderNode)

      let targetCanvasId: string
      if (folderNode?.linkedCanvasId) {
        targetCanvasId = folderNode.linkedCanvasId
      } else if (folderNode?.type === 'character') {
        targetCanvasId = `character-canvas-${folderId}`
      } else {
        targetCanvasId = `folder-canvas-${folderId}`
      }

      console.log('Target canvas ID:', targetCanvasId)

      // Load target folder's canvas data - use maybeSingle to handle non-existent canvases
      const { data: folderCanvasData, error } = await supabase
        .from('canvas_data')
        .select('nodes, connections')
        .eq('story_id', resolvedParams.id)
        .eq('canvas_type', targetCanvasId)
        .maybeSingle()

      console.log('Folder canvas query result:', { data: folderCanvasData, error, targetCanvasId })

      if (error) {
        console.error('Error loading folder canvas:', error.message || error.code || JSON.stringify(error))
        return
      }

      // Add node to folder's canvas with a new position
      const folderNodes = folderCanvasData?.nodes || []
      const nodeWithNewPosition = {
        ...node,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      }

      const updatedFolderNodes = [...folderNodes, nodeWithNewPosition]
      const folderConnections = folderCanvasData?.connections || []

      // Save folder's canvas
      await saveCanvasMutation.mutateAsync({
        storyId: resolvedParams.id,
        canvasType: targetCanvasId,
        nodes: updatedFolderNodes,
        connections: folderConnections,
      })

      console.log('Node moved to folder canvas successfully')
    } catch (err) {
      console.error('Failed to move node to folder:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-sky-600 dark:text-blue-400 animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your story...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header - Always visible */}
      <header className="border-b border-gray-600 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 md:px-4 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Logo Icon - Desktop only */}
            <Sparkles className="hidden md:block w-6 h-6 text-sky-600 dark:text-blue-400" />

            {/* Mobile Navigation - Icon only */}
            <div className="flex md:hidden items-center gap-1">
              {/* Home button */}
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={async (e) => {
                    e.preventDefault()
                    // Mark as internal navigation to prevent popstate and beforeunload interference
                    isInternalNavigation.current = true
                    hasUnsavedChanges.current = false // Clear unsaved changes flag
                    // Save current canvas before navigating to dashboard
                    if (latestCanvasData.current.nodes.length > 0 || latestCanvasData.current.connections.length > 0) {
                      await handleSaveCanvas(latestCanvasData.current.nodes, latestCanvasData.current.connections)
                    }
                    // Use window.location for guaranteed navigation
                    window.location.href = '/dashboard'
                  }}
                >
                  <HomeIcon className="w-4 h-4" />
                </Button>
              </Link>

              {/* Back button - only show if in a folder */}
              {canvasPath.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleNavigateBack()}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}

              {/* Zoom controls - Mobile only */}
              <div className="flex items-center gap-0.5 ml-1">
                <div
                  className="relative"
                  onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Zoom out', x: r.left, y: r.bottom }) }}
                  onMouseLeave={() => setHeaderTooltip(null)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
                <div
                  className="relative"
                  onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Reset zoom', x: r.left, y: r.bottom }) }}
                  onMouseLeave={() => setHeaderTooltip(null)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setZoom(1)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div
                  className="relative"
                  onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Zoom in', x: r.left, y: r.bottom }) }}
                  onMouseLeave={() => setHeaderTooltip(null)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop Breadcrumb navigation */}
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              {/* Dashboard link */}
              <button
                onClick={async (e) => {
                  e.preventDefault()
                  // Mark as internal navigation to prevent popstate and beforeunload interference
                  isInternalNavigation.current = true
                  hasUnsavedChanges.current = false // Clear unsaved changes flag
                  // Save current canvas before navigating to dashboard
                  if (latestCanvasData.current.nodes.length > 0 || latestCanvasData.current.connections.length > 0) {
                    await handleSaveCanvas(latestCanvasData.current.nodes, latestCanvasData.current.connections)
                  }
                  // Use window.location for guaranteed navigation
                  window.location.href = '/dashboard'
                }}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Home
              </button>

              <ChevronRight className="w-4 h-4" />

              {/* Story title - clickable to go to main canvas */}
              <button
                onClick={async () => {
                  if (canvasPath.length === 0) return // Already on main canvas

                  // COLLABORATION FIX: Ask all users to save before we navigate
                  console.log('💾 Broadcasting save request to all collaborators before navigating to main')
                  broadcastSaveRequest()

                  // Wait 500ms + random jitter for other users to save their changes
                  const jitter = Math.random() * 100 // 0-100ms random delay
                  await new Promise(resolve => setTimeout(resolve, 500 + jitter))

                  // Save current canvas
                  // CRITICAL: Validate that latestCanvasData actually belongs to the canvas we're leaving
                  if (latestCanvasDataId.current === currentCanvasId &&
                      (latestCanvasData.current.nodes.length > 0 || latestCanvasData.current.connections.length > 0)) {
                    await handleSaveCanvas(latestCanvasData.current.nodes, latestCanvasData.current.connections)
                  } else if (latestCanvasDataId.current !== currentCanvasId) {
                    console.warn('⚠️ Skipping save - latestCanvasData belongs to', latestCanvasDataId.current, 'not', currentCanvasId)
                  }

                  // Invalidate cache for BOTH canvases:
                  // 1. The canvas we're leaving
                  queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, currentCanvasId) })
                  // 2. Main canvas (where we're going)
                  queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, 'main') })
                  console.log('🔄 Invalidated cache for both canvases:', currentCanvasId, 'and main')

                  // Mark transition to prevent stale broadcasts
                  isCanvasTransition.current = true

                  // Reset folder context and navigate to main
                  colorContext.setCurrentFolderId(null)
                  setCanvasData(null)
                  setIsLoadingCanvas(true)
                  setCanvasPath([])
                  setCurrentCanvasId('main')
                }}
                className={`transition-colors ${
                  canvasPath.length === 0
                    ? "text-foreground font-medium cursor-default"
                    : "hover:text-foreground cursor-pointer"
                }`}
              >
                {story?.title || 'Loading...'}
              </button>

              {/* Folder path */}
              {canvasPath.map((pathItem, index) => (
                <React.Fragment key={`breadcrumb-${index}-${pathItem.id}`}>
                  <ChevronRight className="w-4 h-4" />
                  <button
                    onClick={async () => {
                      if (index === canvasPath.length - 1) return // Already at this location

                      // COLLABORATION FIX: Ask all users to save before we navigate
                      console.log('💾 Broadcasting save request to all collaborators before breadcrumb navigation')
                      broadcastSaveRequest()

                      // Wait 500ms + random jitter for other users to save their changes
                      const jitter = Math.random() * 100 // 0-100ms random delay
                      await new Promise(resolve => setTimeout(resolve, 500 + jitter))

                      // Save current canvas
                      // CRITICAL: Validate that latestCanvasData actually belongs to the canvas we're leaving
                      if (latestCanvasDataId.current === currentCanvasId &&
                          (latestCanvasData.current.nodes.length > 0 || latestCanvasData.current.connections.length > 0)) {
                        await handleSaveCanvas(latestCanvasData.current.nodes, latestCanvasData.current.connections)
                      } else if (latestCanvasDataId.current !== currentCanvasId) {
                        console.warn('⚠️ Skipping save - latestCanvasData belongs to', latestCanvasDataId.current, 'not', currentCanvasId)
                      }

                      // Invalidate cache for BOTH canvases:
                      // 1. The canvas we're leaving
                      queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, currentCanvasId) })
                      // 2. The canvas we're going to
                      queryClient.invalidateQueries({ queryKey: queryKeys.canvas(resolvedParams.id, pathItem.id) })
                      console.log('🔄 Invalidated cache for both canvases:', currentCanvasId, 'and', pathItem.id)

                      // Mark transition to prevent stale broadcasts
                      isCanvasTransition.current = true

                      // Navigate to clicked path level
                      const newPath = canvasPath.slice(0, index + 1)

                      // Extract folder ID from the canvas ID (remove prefixes like 'folder-canvas-')
                      const folderId = pathItem.id.replace(/^(folder-canvas-|character-canvas-|location-canvas-)/, '')
                      colorContext.setCurrentFolderId(folderId)

                      setCanvasData(null)
                      setIsLoadingCanvas(true)
                      setCanvasPath(newPath)
                      setCurrentCanvasId(pathItem.id)
                    }}
                    className={`transition-colors ${
                      index === canvasPath.length - 1
                        ? "text-foreground font-medium cursor-default"
                        : "hover:text-foreground cursor-pointer"
                    }`}
                  >
                    {pathItem.title}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-4">
            {/* Save indicator and manual save button */}
            <div className="flex items-center gap-1">
              {saveCanvasMutation.isPending ? (
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </div>
              ) : (
                <div
                  className="relative"
                  onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Save now', x: r.left, y: r.bottom }) }}
                  onMouseLeave={() => setHeaderTooltip(null)}
                >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (latestCanvasData.current.nodes.length > 0 || latestCanvasData.current.connections.length > 0) {
                      handleSaveCanvas(latestCanvasData.current.nodes, latestCanvasData.current.connections)
                    }
                  }}
                  className="h-8 px-2 gap-1.5"
                >
                  <Cloud className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">Save</span>
                </Button>
              </div>
              )}
            </div>
            {/* Share button - only show for story owner */}
            {storyAccess?.isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareDialog(true)}
                title="Share Project"
                className="gap-1 h-8 w-8 md:w-auto md:px-3 p-0 md:p-2"
              >
                <Users className="w-4 h-4" />
                <span className="hidden md:inline text-xs">Share</span>
              </Button>
            )}
            <div
              className="relative"
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Support Bibliarch', x: r.left, y: r.bottom }) }}
              onMouseLeave={() => setHeaderTooltip(null)}
            >
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <a
                  href="https://pay.zaprite.com/pl_mTYYPoOo2S"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Bitcoin className="w-5 h-5" style={{ transform: 'rotate(0deg)' }} />
                </a>
              </Button>
            </div>
            <FeedbackButton
              onTooltipEnter={(text, x, y) => setHeaderTooltip({ text, x, y })}
              onTooltipLeave={() => setHeaderTooltip(null)}
            />
            <div
              className="relative"
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Export Project', x: r.left, y: r.bottom }) }}
              onMouseLeave={() => setHeaderTooltip(null)}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExportDialog(true)}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
            <ThemeToggle
              onTooltipEnter={(text, x, y) => setHeaderTooltip({ text, x, y })}
              onTooltipLeave={() => setHeaderTooltip(null)}
            />
            <div
              className="relative"
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Canvas Settings', x: r.left - 80, y: r.bottom }) }}
              onMouseLeave={() => setHeaderTooltip(null)}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCanvasSettings(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
            <div
              className="relative"
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHeaderTooltip({ text: 'Sign Out', x: r.left - 40, y: r.bottom }) }}
              onMouseLeave={() => setHeaderTooltip(null)}
            >
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>

      </header>

      {/* Header Tooltip - outside header to avoid overflow issues */}
      {headerTooltip && (
        <div
          className="fixed top-11 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-md shadow-lg border border-border whitespace-nowrap z-50 pointer-events-none"
          style={{ left: headerTooltip.x }}
        >
          {headerTooltip.text}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <Bibliarch
          key={currentCanvasId}
          storyId={resolvedParams.id}
          currentCanvasId={currentCanvasId}
          canvasPath={canvasPath}
          currentFolderId={currentCanvasId !== 'main' ? currentCanvasId : null}
          currentFolderTitle={canvasPath.length > 0 ? canvasPath[canvasPath.length - 1].title : null}
          initialNodes={canvasData?.nodes || []}
          initialConnections={canvasData?.connections || []}
          remoteNodes={remoteUpdate ? remoteUpdate.nodes : undefined}
          remoteConnections={remoteUpdate ? remoteUpdate.connections : undefined}
          onSave={handleSaveCanvas}
          onBroadcastChange={broadcastChange}
          onNavigateToCanvas={handleNavigateToCanvas}
          onStateChange={handleStateChange}
          onPaletteSave={savePaletteToDatabase}
          onMoveNodeToParent={handleMoveNodeToParent}
          onMoveNodeToFolder={handleMoveNodeToFolder}
          canvasWidth={3000}
          canvasHeight={2000}
          zoom={zoom}
          onZoomChange={setZoom}
          eventDepth={canvasPath.filter(item => item.id.startsWith('event-canvas-')).length}
          // Collaboration props
          collaborators={presenceState}
          isViewer={isViewer}
          connectionStatus={connectionStatus}
          lockedNodes={lockedNodes}
          onNodeLock={(nodeId, field) => broadcastNodeLock(nodeId, field, username)}
          onNodeUnlock={broadcastNodeUnlock}
        />

        {/* Loading overlay when switching canvases */}
        {isLoadingCanvas && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-sky-600 dark:text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading canvas...</p>
            </div>
          </div>
        )}
      </div>

      {/* Canvas Settings Dialog */}
      <Dialog open={showCanvasSettings} onOpenChange={setShowCanvasSettings}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Canvas Settings</DialogTitle>
            <DialogDescription>
              Update your project name and description
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="project-name" className="text-sm font-medium">
                Project Name
              </label>
              <Input
                id="project-name"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="project-bio" className="text-sm font-medium">
                  Project Description
                </label>
                <span className="text-xs text-muted-foreground">
                  {editedBio.length}/150
                </span>
              </div>
              <Textarea
                id="project-bio"
                value={editedBio}
                onChange={(e) => {
                  if (e.target.value.length <= 150) {
                    setEditedBio(e.target.value)
                  }
                }}
                placeholder="Describe your story project..."
                rows={5}
                maxLength={150}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditedTitle(story.title)
                setEditedBio(story.bio || '')
                setShowCanvasSettings(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCanvasSettings}
              className="bg-gradient-to-r from-sky-500 to-blue-600 dark:from-blue-500 dark:to-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      {user && story && (
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          storyId={resolvedParams.id}
          userId={user.id}
          storyTitle={story.title}
        />
      )}

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        storyId={resolvedParams.id}
        storyTitle={story?.title || 'Untitled'}
      />

    </div>
  )
}