"use client"

import { useParams } from "next/navigation"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import dynamic from "next/dynamic"
import {
  Film,
  Plus,
  Play,
  Pause,
  SkipBack,
  Trash2,
  Sparkles,
  UserPlus,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Camera,
  Pencil,
  X,
  Repeat,
  Copy,
  GripVertical,
  Sun,
  Undo2,
  Redo2,
  MapPin,
  Link,
  Box,
  Music,
  Circle,
  LayoutGrid,
  Clock,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  Scene,
  SceneCharacter,
  DialogueLine,
  CharacterData,
  TransformGizmoMode,
  CameraKeyframe,
  MovementKeyframe,
  AnimationKeyframe,
  CharacterAnimationState,
  SceneProp,
  PropShape
} from "@/types/scenes"
import type { World } from "@/types/world"
import type { TimelineEvent } from "@/types/timeline"
import { useStoryStore } from "@/stores/storyStore"
import { TimelineEditor } from "@/components/scenes/timeline"
import KeyframePropertiesPanel from "@/components/scenes/KeyframePropertiesPanel"
import SubtitleOverlay from "@/components/scenes/SubtitleOverlay"
import CharacterActionPanel from "@/components/scenes/CharacterActionPanel"
import CameraActionPanel from "@/components/scenes/CameraActionPanel"
import type { SelectionType, SceneViewer3DRef, ContextMenuEvent, LightingPreset } from "@/components/scenes/SceneViewer3D"

// Dynamic import for Three.js component (no SSR)
const SceneViewer3D = dynamic(
  () => import("@/components/scenes/SceneViewer3D"),
  { ssr: false, loading: () => <SceneLoadingPlaceholder /> }
)

function SceneLoadingPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/80 shadow-lg shadow-sky-500/30 flex items-center justify-center">
          <Film className="w-6 h-6 text-sky-500 animate-pulse" />
        </div>
        <p className="text-slate-400">Loading 3D Scene...</p>
      </div>
    </div>
  )
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function ScenesPage() {
  const params = useParams()
  const storyId = params.id as string

  // Scene viewer ref for camera operations
  const viewerRef = useRef<SceneViewer3DRef>(null)

  // Zustand store for scenes
  const EMPTY_SCENES: Scene[] = useMemo(() => [], [])
  const storeScenes = useStoryStore(state => state.scenes[storyId]) as Scene[] | undefined
  const scenes = storeScenes ?? EMPTY_SCENES
  const storeAddScene = useStoryStore(state => state.addScene)
  const storeUpdateScene = useStoryStore(state => state.updateScene)
  const storeDeleteScene = useStoryStore(state => state.deleteScene)
  const storeReorderScenes = useStoryStore(state => state.reorderScenes)
  const world = useStoryStore(state => state.worlds[storyId]) as World | undefined
  const worldLocations = world?.locations || []
  const EMPTY_EVENTS: TimelineEvent[] = useMemo(() => [], [])
  const storeTimelineEvents = useStoryStore(state => state.timelineEvents[storyId]) as TimelineEvent[] | undefined
  const timelineEvents = storeTimelineEvents ?? EMPTY_EVENTS

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)

  // Selection state (unified for characters and camera)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectionType, setSelectionType] = useState<SelectionType>(null)
  const [gizmoMode, setGizmoMode] = useState<TransformGizmoMode>('translate')

  // Keyframe selection (supports multi-select with shift+click)
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null)
  const [selectedKeyframeType, setSelectedKeyframeType] = useState<'camera' | 'movement' | 'animation' | 'dialogue' | null>(null)
  const [selectedKeyframeIds, setSelectedKeyframeIds] = useState<Set<string>>(new Set())

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  // Overview mode
  const [showOverview, setShowOverview] = useState(false)

  // Scene renaming state
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // Drag-reorder state
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null)
  const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; characterId: string | null } | null>(null)

  // Undo/redo history (stores scene snapshots)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const MAX_UNDO = 50

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [loopPlayback, setLoopPlayback] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const playbackRef = useRef<number | null>(null)

  // View through camera toggle
  const [viewThroughCamera, setViewThroughCamera] = useState(false)

  // Dialog states
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [showAddCharacterDialog, setShowAddCharacterDialog] = useState(false)
  const [showAddDialogueDialog, setShowAddDialogueDialog] = useState(false)

  // Full character data from character creator
  const [fullCharacterData, setFullCharacterData] = useState<CharacterData[]>([])

  // New dialogue form
  const [newDialogueCharacterId, setNewDialogueCharacterId] = useState<string>("")
  const [newDialogueText, setNewDialogueText] = useState("")
  const [newDialogueDuration, setNewDialogueDuration] = useState(3)

  // Build character data map for SceneViewer3D
  const characterDataMap = useMemo(() => {
    const map = new Map<string, CharacterData>()
    fullCharacterData.forEach(char => {
      map.set(char.id, char)
    })
    return map
  }, [fullCharacterData])

  // Select first scene on mount or when scenes change
  useEffect(() => {
    if (scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id)
    }
  }, [scenes, selectedSceneId])

  // Capture thumbnail when leaving a scene (switching away)
  const prevSceneIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevSceneIdRef.current && prevSceneIdRef.current !== selectedSceneId) {
      // Capture thumbnail of the scene we're leaving
      const thumbnail = viewerRef.current?.captureThumbnail()
      if (thumbnail) {
        storeUpdateScene(storyId, prevSceneIdRef.current, { thumbnail })
      }
    }
    prevSceneIdRef.current = selectedSceneId
  }, [selectedSceneId, storyId, storeUpdateScene])

  // Load character data from localStorage (character creator writes here)
  useEffect(() => {
    const savedCharacters = localStorage.getItem(`bibliarch-characters-${storyId}`)
    if (savedCharacters) {
      try {
        setFullCharacterData(JSON.parse(savedCharacters))
      } catch (e) {
        console.error("Failed to load characters:", e)
      }
    }
  }, [storyId])

  // Get current scene
  const currentScene = scenes.find(s => s.id === selectedSceneId)

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !currentScene) return

    const startWall = Date.now()
    const startPlaybackTime = currentTime
    const animate = () => {
      const wallElapsed = (Date.now() - startWall) / 1000
      const playbackElapsed = startPlaybackTime + wallElapsed * playbackSpeed
      if (playbackElapsed >= currentScene.duration) {
        if (loopPlayback) {
          setCurrentTime(0)
          // Re-trigger effect by briefly toggling
          setIsPlaying(false)
          requestAnimationFrame(() => setIsPlaying(true))
          return
        }
        setCurrentTime(currentScene.duration)
        setIsPlaying(false)
        return
      }
      setCurrentTime(playbackElapsed)
      playbackRef.current = requestAnimationFrame(animate)
    }

    playbackRef.current = requestAnimationFrame(animate)

    return () => {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current)
      }
    }
  }, [isPlaying, currentScene, playbackSpeed, loopPlayback])

  // Get current dialogue for subtitle
  const currentDialogue = currentScene?.dialogue.find(d =>
    currentTime >= d.startTime && currentTime < d.startTime + d.duration
  )

  // Helper to update the current scene in the store (with undo tracking)
  const updateCurrentScene = useCallback((updates: Partial<Scene>) => {
    if (!selectedSceneId) return
    // Push snapshot of current scene state onto undo stack
    const current = scenes.find(s => s.id === selectedSceneId)
    if (current) {
      const snapshot = JSON.stringify(current)
      undoStackRef.current.push(snapshot)
      if (undoStackRef.current.length > MAX_UNDO) {
        undoStackRef.current.shift()
      }
      // Clear redo stack on new action
      redoStackRef.current = []
    }
    storeUpdateScene(storyId, selectedSceneId, updates)
  }, [storyId, selectedSceneId, storeUpdateScene, scenes])

  // Undo: restore previous scene state
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0 || !selectedSceneId) return
    const currentScene = scenes.find(s => s.id === selectedSceneId)
    if (currentScene) {
      redoStackRef.current.push(JSON.stringify(currentScene))
    }
    const snapshot = undoStackRef.current.pop()!
    const restored = JSON.parse(snapshot) as Scene
    // Apply all fields from the snapshot
    const { id: _id, storyId: _sid, ...updates } = restored
    storeUpdateScene(storyId, selectedSceneId, updates)
  }, [selectedSceneId, scenes, storyId, storeUpdateScene])

  // Redo: restore next scene state
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0 || !selectedSceneId) return
    const currentScene = scenes.find(s => s.id === selectedSceneId)
    if (currentScene) {
      undoStackRef.current.push(JSON.stringify(currentScene))
    }
    const snapshot = redoStackRef.current.pop()!
    const restored = JSON.parse(snapshot) as Scene
    const { id: _id, storyId: _sid, ...updates } = restored
    storeUpdateScene(storyId, selectedSceneId, updates)
  }, [selectedSceneId, scenes, storyId, storeUpdateScene])

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  // Scene operations
  const createScene = useCallback(() => {
    const newScene: Scene = {
      id: generateId(),
      storyId,
      title: `Scene ${scenes.length + 1}`,
      characters: [],
      dialogue: [],
      duration: 10,
      cameraKeyframes: [],
      movementKeyframes: [],
      animationKeyframes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    storeAddScene(storyId, newScene)
    setSelectedSceneId(newScene.id)
  }, [storyId, scenes.length, storeAddScene])

  const deleteScene = useCallback((id: string) => {
    if (!confirm("Delete this scene?")) return
    storeDeleteScene(storyId, id)
    if (selectedSceneId === id) {
      setSelectedSceneId(scenes.find(s => s.id !== id)?.id || null)
    }
  }, [storyId, selectedSceneId, scenes, storeDeleteScene])

  const duplicateScene = useCallback((sceneId: string) => {
    const source = scenes.find(s => s.id === sceneId)
    if (!source) return
    const newScene: Scene = {
      ...JSON.parse(JSON.stringify(source)),
      id: generateId(),
      title: `${source.title} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    storeAddScene(storyId, newScene)
    setSelectedSceneId(newScene.id)
  }, [scenes, storyId, storeAddScene])

  const handleSceneDragStart = useCallback((e: React.DragEvent, sceneId: string) => {
    setDraggedSceneId(sceneId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleSceneDragOver = useCallback((e: React.DragEvent, sceneId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSceneId(sceneId)
  }, [])

  const handleSceneDrop = useCallback((e: React.DragEvent, targetSceneId: string) => {
    e.preventDefault()
    if (!draggedSceneId || draggedSceneId === targetSceneId) {
      setDraggedSceneId(null)
      setDragOverSceneId(null)
      return
    }
    const ids = scenes.map(s => s.id)
    const fromIdx = ids.indexOf(draggedSceneId)
    const toIdx = ids.indexOf(targetSceneId)
    if (fromIdx === -1 || toIdx === -1) return
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, draggedSceneId)
    storeReorderScenes(storyId, ids)
    setDraggedSceneId(null)
    setDragOverSceneId(null)
  }, [draggedSceneId, scenes, storyId, storeReorderScenes])

  const handleSceneDragEnd = useCallback(() => {
    setDraggedSceneId(null)
    setDragOverSceneId(null)
  }, [])

  // Selection handler
  const handleSelect = useCallback((id: string | null, type: SelectionType) => {
    setSelectedId(id)
    setSelectionType(type)
    // Clear keyframe selection when selecting objects
    if (id) {
      setSelectedKeyframeId(null)
      setSelectedKeyframeType(null)
    }
  }, [])

  // Scene renaming
  const startRenaming = useCallback((sceneId: string, currentTitle: string) => {
    setRenamingSceneId(sceneId)
    setRenameValue(currentTitle)
  }, [])

  const finishRenaming = useCallback(() => {
    if (renamingSceneId && renameValue.trim()) {
      storeUpdateScene(storyId, renamingSceneId, { title: renameValue.trim() })
    }
    setRenamingSceneId(null)
    setRenameValue("")
  }, [renamingSceneId, renameValue, storyId, storeUpdateScene])

  // Remove character from scene
  const removeCharacterFromScene = useCallback((sceneCharId: string) => {
    if (!currentScene) return
    const updatedCharacters = currentScene.characters.filter(c => c.id !== sceneCharId)
    const updatedMovementKeyframes = (currentScene.movementKeyframes || []).filter(kf => kf.characterId !== sceneCharId)
    const updatedAnimationKeyframes = (currentScene.animationKeyframes || []).filter(kf => kf.characterId !== sceneCharId)
    const updatedDialogue = currentScene.dialogue.filter(d => d.characterId !== sceneCharId)
    updateCurrentScene({
      characters: updatedCharacters,
      movementKeyframes: updatedMovementKeyframes,
      animationKeyframes: updatedAnimationKeyframes,
      dialogue: updatedDialogue
    })
    if (selectedId === sceneCharId) {
      setSelectedId(null)
      setSelectionType(null)
    }
  }, [currentScene, selectedId, updateCurrentScene])

  // Character operations
  const addCharacterToScene = useCallback((characterId: string) => {
    if (!currentScene) return
    const char = fullCharacterData.find(c => c.id === characterId)
    if (!char) return

    if (currentScene.characters.some(c => c.characterId === characterId)) {
      return
    }

    const sceneChar: SceneCharacter = {
      id: generateId(),
      characterId: char.id,
      name: char.name,
      position: [currentScene.characters.length * 2 - 2, 0, 0],
      rotation: 0
    }

    updateCurrentScene({ characters: [...currentScene.characters, sceneChar] })
    setShowAddCharacterDialog(false)
  }, [currentScene, fullCharacterData, updateCurrentScene])

  const moveCharacter = useCallback((sceneCharId: string, position: [number, number, number], rotation: number) => {
    if (!currentScene) return

    const updatedCharacters = currentScene.characters.map(c =>
      c.id === sceneCharId ? { ...c, position, rotation } : c
    )

    // Auto-keyframe: create or update movement keyframe at current time
    const existingKeyframes = currentScene.movementKeyframes || []
    const TIME_THRESHOLD = 0.1
    const existingKf = existingKeyframes.find(
      kf => kf.characterId === sceneCharId && Math.abs(kf.time - currentTime) < TIME_THRESHOLD
    )

    let updatedMovementKeyframes: MovementKeyframe[]
    if (existingKf) {
      updatedMovementKeyframes = existingKeyframes.map(kf =>
        kf.id === existingKf.id ? { ...kf, position, rotation } : kf
      )
    } else {
      const newKf: MovementKeyframe = {
        id: generateId(),
        characterId: sceneCharId,
        time: Math.round(currentTime * 100) / 100,
        position,
        rotation,
        easing: 'ease-out'
      }
      updatedMovementKeyframes = [...existingKeyframes, newKf]
      setSelectedKeyframeId(newKf.id)
      setSelectedKeyframeType('movement')
    }

    updateCurrentScene({ characters: updatedCharacters, movementKeyframes: updatedMovementKeyframes })
  }, [currentScene, currentTime, updateCurrentScene])

  const moveCamera = useCallback((position: [number, number, number], rotation: [number, number, number]) => {
    if (!currentScene) return

    const existingKeyframes = currentScene.cameraKeyframes || []
    const TIME_THRESHOLD = 0.1
    const existingKf = existingKeyframes.find(
      kf => Math.abs(kf.time - currentTime) < TIME_THRESHOLD
    )

    const fov = viewerRef.current?.getCameraState().fov || 50

    let updatedCameraKeyframes: CameraKeyframe[]
    if (existingKf) {
      updatedCameraKeyframes = existingKeyframes.map(kf =>
        kf.id === existingKf.id ? { ...kf, position, rotation, fov } : kf
      )
    } else {
      const newKf: CameraKeyframe = {
        id: generateId(),
        time: Math.round(currentTime * 100) / 100,
        position,
        rotation,
        fov,
        easing: 'ease-out'
      }
      updatedCameraKeyframes = [...existingKeyframes, newKf]
      setSelectedKeyframeId(newKf.id)
      setSelectedKeyframeType('camera')
    }

    updateCurrentScene({ cameraKeyframes: updatedCameraKeyframes })
  }, [currentScene, currentTime, updateCurrentScene])

  // Camera keyframe operations
  const addCameraKeyframe = useCallback((time: number) => {
    if (!currentScene) return

    const cameraState = viewerRef.current?.getCameraState() || {
      position: [0, 2, 8] as [number, number, number],
      rotation: [0, Math.PI, 0] as [number, number, number],
      fov: 50
    }

    const newKf: CameraKeyframe = {
      id: generateId(),
      time,
      position: cameraState.position,
      rotation: cameraState.rotation,
      fov: cameraState.fov,
      easing: 'ease-out'
    }

    updateCurrentScene({ cameraKeyframes: [...(currentScene.cameraKeyframes || []), newKf] })
    setSelectedKeyframeId(newKf.id)
    setSelectedKeyframeType('camera')
  }, [currentScene, updateCurrentScene])

  const updateCameraKeyframe = useCallback((id: string, updates: Partial<CameraKeyframe>) => {
    if (!currentScene) return
    updateCurrentScene({
      cameraKeyframes: (currentScene.cameraKeyframes || []).map(kf =>
        kf.id === id ? { ...kf, ...updates } : kf
      )
    })
  }, [currentScene, updateCurrentScene])

  const deleteCameraKeyframe = useCallback((id: string) => {
    if (!currentScene) return
    updateCurrentScene({
      cameraKeyframes: (currentScene.cameraKeyframes || []).filter(kf => kf.id !== id)
    })
    if (selectedKeyframeId === id) {
      setSelectedKeyframeId(null)
      setSelectedKeyframeType(null)
    }
  }, [currentScene, selectedKeyframeId, updateCurrentScene])

  // Movement keyframe operations
  const addMovementKeyframe = useCallback((characterId: string, time: number) => {
    if (!currentScene) return

    const char = currentScene.characters.find(c => c.id === characterId)
    if (!char) return

    const newKf: MovementKeyframe = {
      id: generateId(),
      characterId,
      time,
      position: [...char.position] as [number, number, number],
      rotation: char.rotation,
      easing: 'ease-out'
    }

    updateCurrentScene({ movementKeyframes: [...(currentScene.movementKeyframes || []), newKf] })
    setSelectedKeyframeId(newKf.id)
    setSelectedKeyframeType('movement')
  }, [currentScene, updateCurrentScene])

  const updateMovementKeyframe = useCallback((id: string, updates: Partial<MovementKeyframe>) => {
    if (!currentScene) return
    updateCurrentScene({
      movementKeyframes: (currentScene.movementKeyframes || []).map(kf =>
        kf.id === id ? { ...kf, ...updates } : kf
      )
    })
  }, [currentScene, updateCurrentScene])

  const deleteMovementKeyframe = useCallback((id: string) => {
    if (!currentScene) return
    updateCurrentScene({
      movementKeyframes: (currentScene.movementKeyframes || []).filter(kf => kf.id !== id)
    })
    if (selectedKeyframeId === id) {
      setSelectedKeyframeId(null)
      setSelectedKeyframeType(null)
    }
  }, [currentScene, selectedKeyframeId, updateCurrentScene])

  // Animation keyframe operations
  const addAnimationKeyframe = useCallback((characterId: string, time: number) => {
    if (!currentScene) return

    const char = currentScene.characters.find(c => c.id === characterId)
    if (!char) return

    const newKf: AnimationKeyframe = {
      id: generateId(),
      characterId,
      time,
      animation: char.animation || {
        basePose: null,
        emotion: null,
        emotionIntensity: 1,
        clipAnimation: null,
        clipLoop: true
      },
      easing: 'ease-out'
    }

    updateCurrentScene({ animationKeyframes: [...(currentScene.animationKeyframes || []), newKf] })
    setSelectedKeyframeId(newKf.id)
    setSelectedKeyframeType('animation')
  }, [currentScene, updateCurrentScene])

  const updateAnimationKeyframe = useCallback((id: string, updates: Partial<AnimationKeyframe>) => {
    if (!currentScene) return
    updateCurrentScene({
      animationKeyframes: (currentScene.animationKeyframes || []).map(kf =>
        kf.id === id ? { ...kf, ...updates } : kf
      )
    })
  }, [currentScene, updateCurrentScene])

  const deleteAnimationKeyframe = useCallback((id: string) => {
    if (!currentScene) return
    updateCurrentScene({
      animationKeyframes: (currentScene.animationKeyframes || []).filter(kf => kf.id !== id)
    })
    if (selectedKeyframeId === id) {
      setSelectedKeyframeId(null)
      setSelectedKeyframeType(null)
    }
  }, [currentScene, selectedKeyframeId, updateCurrentScene])

  // Dialogue operations
  const addDialogue = useCallback(() => {
    if (!currentScene || !newDialogueCharacterId || !newDialogueText) return

    const sceneChar = currentScene.characters.find(c => c.id === newDialogueCharacterId)
    if (!sceneChar) return

    const newDialogue: DialogueLine = {
      id: generateId(),
      characterId: newDialogueCharacterId,
      characterName: sceneChar.name,
      text: newDialogueText,
      startTime: currentTime,
      duration: newDialogueDuration
    }

    const endTime = newDialogue.startTime + newDialogue.duration
    const newDuration = Math.max(currentScene.duration, endTime + 1)

    updateCurrentScene({ dialogue: [...currentScene.dialogue, newDialogue], duration: newDuration })

    setShowAddDialogueDialog(false)
    setNewDialogueCharacterId("")
    setNewDialogueText("")
    setNewDialogueDuration(3)
  }, [currentScene, newDialogueCharacterId, newDialogueText, newDialogueDuration, currentTime, updateCurrentScene])

  const updateDialogue = useCallback((id: string, updates: Partial<DialogueLine>) => {
    if (!currentScene) return
    updateCurrentScene({
      dialogue: currentScene.dialogue.map(d =>
        d.id === id ? { ...d, ...updates } : d
      )
    })
  }, [currentScene, updateCurrentScene])

  const deleteDialogue = useCallback((id: string) => {
    if (!currentScene) return
    updateCurrentScene({
      dialogue: currentScene.dialogue.filter(d => d.id !== id)
    })
    if (selectedKeyframeId === id) {
      setSelectedKeyframeId(null)
      setSelectedKeyframeType(null)
    }
  }, [currentScene, selectedKeyframeId, updateCurrentScene])

  // Duration change
  const handleDurationChange = useCallback((newDuration: number) => {
    if (!currentScene) return
    updateCurrentScene({ duration: Math.max(1, newDuration) })
  }, [currentScene, updateCurrentScene])

  // Get selected character data
  const selectedCharacter = currentScene?.characters.find(c => c.id === selectedId)

  // Change character pose (creates animation keyframe)
  const handleChangePose = useCallback((poseId: string, posePath: string | null) => {
    if (!currentScene || !selectedId) return

    const animation: CharacterAnimationState = {
      basePose: poseId,
      emotion: selectedCharacter?.animation?.emotion || null,
      emotionIntensity: selectedCharacter?.animation?.emotionIntensity || 1,
      clipAnimation: posePath ? poseId : null,
      clipLoop: true
    }

    const updatedCharacters = currentScene.characters.map(c =>
      c.id === selectedId ? { ...c, animation } : c
    )

    const existingKf = (currentScene.animationKeyframes || []).find(
      kf => kf.characterId === selectedId && Math.abs(kf.time - currentTime) < 0.1
    )

    let updatedAnimationKeyframes: AnimationKeyframe[]
    if (existingKf) {
      updatedAnimationKeyframes = (currentScene.animationKeyframes || []).map(kf =>
        kf.id === existingKf.id ? { ...kf, animation } : kf
      )
    } else {
      const newKf: AnimationKeyframe = {
        id: generateId(),
        characterId: selectedId,
        time: Math.round(currentTime * 100) / 100,
        animation,
        easing: 'ease-out'
      }
      updatedAnimationKeyframes = [...(currentScene.animationKeyframes || []), newKf]
    }

    updateCurrentScene({ characters: updatedCharacters, animationKeyframes: updatedAnimationKeyframes })
  }, [currentScene, selectedId, selectedCharacter, currentTime, updateCurrentScene])

  // Change character emotion
  const handleChangeEmotion = useCallback((emotionId: string) => {
    if (!currentScene || !selectedId) return

    const animation: CharacterAnimationState = {
      basePose: selectedCharacter?.animation?.basePose || null,
      emotion: emotionId,
      emotionIntensity: 1,
      clipAnimation: selectedCharacter?.animation?.clipAnimation || null,
      clipLoop: selectedCharacter?.animation?.clipLoop ?? true
    }

    const updatedCharacters = currentScene.characters.map(c =>
      c.id === selectedId ? { ...c, animation } : c
    )

    const existingKf = (currentScene.animationKeyframes || []).find(
      kf => kf.characterId === selectedId && Math.abs(kf.time - currentTime) < 0.1
    )

    let updatedAnimationKeyframes: AnimationKeyframe[]
    if (existingKf) {
      updatedAnimationKeyframes = (currentScene.animationKeyframes || []).map(kf =>
        kf.id === existingKf.id ? { ...kf, animation } : kf
      )
    } else {
      const newKf: AnimationKeyframe = {
        id: generateId(),
        characterId: selectedId,
        time: Math.round(currentTime * 100) / 100,
        animation,
        easing: 'ease-out'
      }
      updatedAnimationKeyframes = [...(currentScene.animationKeyframes || []), newKf]
    }

    updateCurrentScene({ characters: updatedCharacters, animationKeyframes: updatedAnimationKeyframes })
  }, [currentScene, selectedId, selectedCharacter, currentTime, updateCurrentScene])

  // Quick add dialogue from action panel
  const handleQuickAddDialogue = useCallback((text: string) => {
    if (!currentScene || !selectedId || !selectedCharacter) return

    const newDialogue: DialogueLine = {
      id: generateId(),
      characterId: selectedId,
      characterName: selectedCharacter.name,
      text,
      startTime: currentTime,
      duration: Math.max(2, Math.ceil(text.length / 15))
    }

    const endTime = newDialogue.startTime + newDialogue.duration
    const newDuration = Math.max(currentScene.duration, endTime + 1)

    updateCurrentScene({ dialogue: [...currentScene.dialogue, newDialogue], duration: newDuration })
  }, [currentScene, selectedId, selectedCharacter, currentTime, updateCurrentScene])

  // Apply camera preset
  const handleApplyCameraPreset = useCallback((position: number[], rotation: number[], fov: number) => {
    if (!currentScene) return

    const pos = position as [number, number, number]
    const rot = rotation as [number, number, number]

    viewerRef.current?.setCameraState({ position: pos, rotation: rot, fov })

    const existingKf = (currentScene.cameraKeyframes || []).find(
      kf => Math.abs(kf.time - currentTime) < 0.1
    )

    let updatedCameraKeyframes: CameraKeyframe[]
    if (existingKf) {
      updatedCameraKeyframes = (currentScene.cameraKeyframes || []).map(kf =>
        kf.id === existingKf.id ? { ...kf, position: pos, rotation: rot, fov } : kf
      )
    } else {
      const newKf: CameraKeyframe = {
        id: generateId(),
        time: Math.round(currentTime * 100) / 100,
        position: pos,
        rotation: rot,
        fov,
        easing: 'ease-out'
      }
      updatedCameraKeyframes = [...(currentScene.cameraKeyframes || []), newKf]
    }

    updateCurrentScene({ cameraKeyframes: updatedCameraKeyframes })
  }, [currentScene, currentTime, updateCurrentScene])

  // Change camera FOV
  const handleChangeFov = useCallback((fov: number) => {
    if (!currentScene) return

    const cameraState = viewerRef.current?.getCameraState()
    if (cameraState) {
      viewerRef.current?.setCameraState({ ...cameraState, fov })
    }

    const existingKf = (currentScene.cameraKeyframes || []).find(
      kf => Math.abs(kf.time - currentTime) < 0.1
    )

    if (existingKf) {
      updateCurrentScene({
        cameraKeyframes: (currentScene.cameraKeyframes || []).map(kf =>
          kf.id === existingKf.id ? { ...kf, fov } : kf
        )
      })
    }
  }, [currentScene, currentTime, updateCurrentScene])

  // Keyframe selection (supports shift+click multi-select)
  const handleSelectKeyframe = useCallback((id: string | null, type: 'camera' | 'movement' | 'animation' | 'dialogue' | null, shiftKey?: boolean) => {
    if (id && shiftKey) {
      // Multi-select: toggle this keyframe in the set
      setSelectedKeyframeIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        // Also include the primary selection if it's not already in the set
        if (selectedKeyframeId && !next.has(selectedKeyframeId)) {
          next.add(selectedKeyframeId)
        }
        return next
      })
      setSelectedKeyframeId(id)
      setSelectedKeyframeType(type)
    } else {
      setSelectedKeyframeId(id)
      setSelectedKeyframeType(type)
      setSelectedKeyframeIds(id ? new Set([id]) : new Set())
    }
    // Clear object selection when selecting keyframes
    if (id) {
      setSelectedId(null)
      setSelectionType(null)
    }
  }, [selectedKeyframeId])

  // Playback controls
  const handlePlayPause = useCallback(() => {
    if (!currentScene) return
    if (isPlaying) {
      setIsPlaying(false)
      setIsRecording(false)
    } else {
      if (currentTime >= currentScene.duration) {
        setCurrentTime(0)
      }
      setIsPlaying(true)
      // Auto-enable camera view during playback (unless recording)
      if (!isRecording) {
        setViewThroughCamera(true)
      }
    }
  }, [isPlaying, currentTime, currentScene, isRecording])

  const handleToggleRecord = useCallback(() => {
    if (!currentScene) return
    if (isRecording) {
      setIsRecording(false)
    } else {
      setIsRecording(true)
      // Start recording: begin playback if not already playing
      if (!isPlaying) {
        if (currentTime >= currentScene.duration) {
          setCurrentTime(0)
        }
        setIsPlaying(true)
        // Don't enable camera view during recording (user needs to interact)
        setViewThroughCamera(false)
      }
    }
  }, [isRecording, isPlaying, currentTime, currentScene])

  const handleRestart = useCallback(() => {
    setCurrentTime(0)
    setIsPlaying(false)
  }, [])

  // Context menu
  const handleViewportContextMenu = useCallback((event: ContextMenuEvent) => {
    setContextMenu({ x: event.x, y: event.y, characterId: event.characterId })
    if (event.characterId) {
      setSelectedId(event.characterId)
      setSelectionType('character')
    }
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Batch delete selected keyframes
  const handleBatchDeleteKeyframes = useCallback(() => {
    if (!currentScene || selectedKeyframeIds.size === 0) return
    const ids = selectedKeyframeIds
    updateCurrentScene({
      cameraKeyframes: (currentScene.cameraKeyframes || []).filter(kf => !ids.has(kf.id)),
      movementKeyframes: (currentScene.movementKeyframes || []).filter(kf => !ids.has(kf.id)),
      animationKeyframes: (currentScene.animationKeyframes || []).filter(kf => !ids.has(kf.id)),
      dialogue: currentScene.dialogue.filter(d => !ids.has(d.id))
    })
    setSelectedKeyframeId(null)
    setSelectedKeyframeType(null)
    setSelectedKeyframeIds(new Set())
  }, [currentScene, selectedKeyframeIds, updateCurrentScene])

  // Global keyboard handler for batch delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeIds.size > 1) {
        e.preventDefault()
        handleBatchDeleteKeyframes()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedKeyframeIds, handleBatchDeleteKeyframes])

  // Add prop to scene
  const addProp = useCallback((shape: PropShape = 'cube') => {
    if (!currentScene) return
    const existingProps = currentScene.props || []
    const newProp: SceneProp = {
      id: generateId(),
      name: `${shape.charAt(0).toUpperCase() + shape.slice(1)} ${existingProps.length + 1}`,
      shape,
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#888888'
    }
    updateCurrentScene({ props: [...existingProps, newProp] })
  }, [currentScene, updateCurrentScene])

  const removeProp = useCallback((propId: string) => {
    if (!currentScene) return
    updateCurrentScene({ props: (currentScene.props || []).filter(p => p.id !== propId) })
  }, [currentScene, updateCurrentScene])

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time)
    if (isPlaying) {
      setIsPlaying(false)
    }
  }, [isPlaying])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Capture camera position for keyframe
  const captureCameraPosition = useCallback(() => {
    return viewerRef.current?.getCameraState() || null
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-sm pl-20 pr-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-600/20 flex items-center justify-center">
              <Film className="w-4 h-4 text-sky-400" />
            </div>
            <h1 className="text-lg font-semibold text-slate-200">
              Scenes
            </h1>
            <span className="text-sm text-slate-400">
              ({scenes.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOverview(!showOverview)}
              className={`border-slate-700 hover:bg-slate-700 hover:text-slate-200 ${
                showOverview ? 'bg-sky-500/20 text-sky-400 border-sky-500/50' : 'bg-slate-800/80 text-slate-400'
              }`}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAIDialog(true)} className="bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate with AI
            </Button>
            <Button size="sm" onClick={createScene} className="bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-sky-500/30">
              <Plus className="w-4 h-4 mr-2" />
              New Scene
            </Button>
          </div>
        </div>
      </header>

      {/* Main Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Scene Sidebar */}
        <div className={`border-r border-slate-700/50 bg-slate-800/60 backdrop-blur-sm flex flex-col transition-all ${
          sidebarCollapsed ? 'w-10' : 'w-48'
        }`}>
          {/* Toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-10 flex items-center justify-center border-b border-slate-700/30 hover:bg-slate-700/50 transition-colors"
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4 text-slate-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Scene list (hidden when collapsed) */}
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto p-2">
              {scenes.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  No scenes yet
                </p>
              ) : (
                <ul className="space-y-1">
                  {scenes.map((scene) => (
                    <li
                      key={scene.id}
                      draggable={renamingSceneId !== scene.id}
                      onDragStart={(e) => handleSceneDragStart(e, scene.id)}
                      onDragOver={(e) => handleSceneDragOver(e, scene.id)}
                      onDrop={(e) => handleSceneDrop(e, scene.id)}
                      onDragEnd={handleSceneDragEnd}
                      onClick={() => {
                        if (renamingSceneId) return
                        setSelectedSceneId(scene.id)
                        setSelectedId(null)
                        setSelectionType(null)
                        setSelectedKeyframeId(null)
                        setSelectedKeyframeType(null)
                        setCurrentTime(0)
                        setIsPlaying(false)
                      }}
                      className={`group px-2 py-1.5 rounded text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        selectedSceneId === scene.id
                          ? "bg-sky-500/20 text-sky-300"
                          : "hover:bg-slate-700/50 text-slate-300"
                      } ${dragOverSceneId === scene.id && draggedSceneId !== scene.id ? "border-t-2 border-sky-400" : ""} ${draggedSceneId === scene.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {/* Thumbnail */}
                        {scene.thumbnail && (
                          <div className="w-full h-16 rounded overflow-hidden bg-slate-900">
                            <img src={scene.thumbnail} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3 h-3 flex-shrink-0 text-slate-600 cursor-grab opacity-0 group-hover:opacity-100" />
                          {renamingSceneId === scene.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={finishRenaming}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') finishRenaming()
                                if (e.key === 'Escape') { setRenamingSceneId(null); setRenameValue("") }
                              }}
                              className="bg-slate-900 border border-sky-500 rounded px-1 py-0 text-xs text-slate-200 w-full outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate">{scene.title}</span>
                          )}
                        </div>
                      </div>
                      {renamingSceneId !== scene.id && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              duplicateScene(scene.id)
                            }}
                            className="text-slate-500 hover:text-sky-400"
                            title="Duplicate scene"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startRenaming(scene.id, scene.title)
                            }}
                            className="text-slate-500 hover:text-sky-400"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteScene(scene.id)
                            }}
                            className="text-slate-500 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {showOverview ? (
            /* ===== SCENE OVERVIEW DASHBOARD ===== */
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-800 to-slate-900">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-200">Scene Overview</h2>
                    <p className="text-sm text-slate-400 mt-1">{scenes.length} scene{scenes.length !== 1 ? 's' : ''} total</p>
                  </div>
                </div>

                {scenes.length === 0 ? (
                  <div className="text-center py-20">
                    <Film className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-4">No scenes yet. Create your first scene!</p>
                    <Button onClick={createScene} className="bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:opacity-90">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Scene
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {scenes.map(scene => (
                      <div
                        key={scene.id}
                        onClick={() => { setSelectedSceneId(scene.id); setShowOverview(false) }}
                        className="bg-slate-800/80 border border-slate-700/50 rounded-xl overflow-hidden hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 transition-all cursor-pointer group"
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video bg-slate-900 relative overflow-hidden">
                          {scene.thumbnail ? (
                            <img src={scene.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-8 h-8 text-slate-700" />
                            </div>
                          )}
                          {/* Duration badge */}
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(scene.duration / 60)}:{Math.floor(scene.duration % 60).toString().padStart(2, '0')}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-3">
                          <h3 className="text-sm font-medium text-slate-200 truncate group-hover:text-sky-300 transition-colors">
                            {scene.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {scene.characters.length} char{scene.characters.length !== 1 ? 's' : ''}
                            </span>
                            <span>
                              {(scene.cameraKeyframes?.length || 0) + (scene.movementKeyframes?.length || 0) + (scene.animationKeyframes?.length || 0)} keyframes
                            </span>
                            <span>{scene.dialogue.length} lines</span>
                          </div>
                          {scene.lightingPreset && scene.lightingPreset !== 'default' && (
                            <span className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 capitalize">
                              {scene.lightingPreset}
                            </span>
                          )}
                          {scene.backgroundMusic && (
                            <span className="inline-block mt-1.5 ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 capitalize">
                              {scene.backgroundMusic}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : currentScene ? (
            <>
              {/* 3D Viewport and Properties */}
              <div className="flex-1 flex overflow-hidden">
                {/* 3D Viewport */}
                <div className="flex-1 relative min-w-0">
                  <SceneViewer3D
                    ref={viewerRef}
                    characters={currentScene.characters}
                    characterDataMap={characterDataMap}
                    selectedId={selectedId}
                    selectionType={selectionType}
                    onSelect={handleSelect}
                    onMoveCharacter={moveCharacter}
                    onMoveCamera={moveCamera}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    gizmoMode={gizmoMode}
                    onGizmoModeChange={setGizmoMode}
                    cameraKeyframes={currentScene.cameraKeyframes}
                    movementKeyframes={currentScene.movementKeyframes}
                    animationKeyframes={currentScene.animationKeyframes}
                    viewThroughCamera={viewThroughCamera}
                    onContextMenu={handleViewportContextMenu}
                    lightingPreset={(currentScene.lightingPreset as LightingPreset) || 'default'}
                    props={currentScene.props || []}
                    isRecording={isRecording}
                    storyId={storyId}
                    locationId={currentScene.locationId}
                  />

                  {/* Status indicator */}
                  <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                    {isRecording ? (
                      <>
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        Recording... Move characters to create keyframes
                      </>
                    ) : isPlaying ? (
                      <>
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        Playing...
                      </>
                    ) : viewThroughCamera ? (
                      "Camera Preview | Click 'Exit Camera' to edit"
                    ) : selectionType === 'camera' ? (
                      "Camera | G: Move | R: Rotate | Use panel below"
                    ) : selectionType === 'character' && selectedCharacter ? (
                      `${selectedCharacter.name} | G: Move | R: Rotate | Use panel below`
                    ) : (
                      "Click character or camera to edit"
                    )}
                  </div>

                  {/* Top right controls */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {/* Location backdrop picker */}
                    <div className="flex items-center gap-1 bg-slate-800/80 rounded-full px-2 py-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      <select
                        value={currentScene.locationId || ''}
                        onChange={(e) => updateCurrentScene({ locationId: e.target.value || undefined })}
                        className="bg-slate-800 text-xs text-slate-200 outline-none cursor-pointer border-slate-600 [&>option]:bg-slate-800 [&>option]:text-slate-200"
                      >
                        <option value="">No Location</option>
                        {worldLocations.length > 0 ? (
                          worldLocations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))
                        ) : (
                          <option value="" disabled>Build a world first</option>
                        )}
                      </select>
                    </div>

                    {/* Timeline event link */}
                    {timelineEvents.length > 0 && (
                      <div className="flex items-center gap-1 bg-slate-800/80 rounded-full px-2 py-1">
                        <Link className="w-3 h-3 text-violet-400" />
                        <select
                          value={currentScene.linkedTimelineEventId || ''}
                          onChange={(e) => updateCurrentScene({ linkedTimelineEventId: e.target.value || undefined })}
                          className="bg-slate-800 text-xs text-slate-200 outline-none cursor-pointer max-w-[120px] border-slate-600 [&>option]:bg-slate-800 [&>option]:text-slate-200"
                        >
                          <option value="">No Event</option>
                          {timelineEvents.map(evt => (
                            <option key={evt.id} value={evt.id}>{evt.title}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Lighting preset */}
                    <div className="flex items-center gap-1 bg-slate-800/80 rounded-full px-2 py-1">
                      <Sun className="w-3 h-3 text-amber-400" />
                      <select
                        value={(currentScene.lightingPreset as LightingPreset) || 'default'}
                        onChange={(e) => updateCurrentScene({ lightingPreset: e.target.value })}
                        className="bg-slate-800 text-xs text-slate-200 outline-none cursor-pointer border-slate-600 [&>option]:bg-slate-800 [&>option]:text-slate-200"
                      >
                        <option value="default">Default</option>
                        <option value="day">Day</option>
                        <option value="night">Night</option>
                        <option value="sunset">Sunset</option>
                        <option value="dramatic">Dramatic</option>
                        <option value="studio">Studio</option>
                      </select>
                    </div>

                    {/* Background music */}
                    <div className="flex items-center gap-1 bg-slate-800/80 rounded-full px-2 py-1">
                      <Music className="w-3 h-3 text-pink-400" />
                      <select
                        value={currentScene.backgroundMusic || ''}
                        onChange={(e) => updateCurrentScene({ backgroundMusic: e.target.value || undefined })}
                        className="bg-slate-800 text-xs text-slate-200 outline-none cursor-pointer border-slate-600 [&>option]:bg-slate-800 [&>option]:text-slate-200"
                      >
                        <option value="">No Music</option>
                        <option value="peaceful">Peaceful</option>
                        <option value="tense">Tense</option>
                        <option value="romantic">Romantic</option>
                        <option value="action">Action</option>
                        <option value="mysterious">Mysterious</option>
                        <option value="sad">Sad</option>
                        <option value="comedy">Comedy</option>
                        <option value="epic">Epic</option>
                      </select>
                    </div>

                    {/* View through camera toggle */}
                    <button
                      onClick={() => {
                        if (!viewThroughCamera) {
                          // Entering camera view — save user camera
                          viewerRef.current?.saveUserCamera()
                          setViewThroughCamera(true)
                        } else {
                          // Exiting camera view — restore user camera
                          setViewThroughCamera(false)
                          setTimeout(() => viewerRef.current?.restoreUserCamera(), 50)
                        }
                      }}
                      className={`bg-slate-800/80 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors ${
                        viewThroughCamera ? 'text-sky-400 ring-1 ring-sky-400' : 'text-slate-300'
                      }`}
                      title={viewThroughCamera ? "Exit Camera View" : "View Through Camera"}
                    >
                      <Camera className="w-3 h-3" />
                      {viewThroughCamera ? 'Exit Camera' : 'Camera View'}
                    </button>

                    {/* Remove character button */}
                    {selectionType === 'character' && selectedId && !isPlaying && (
                      <button
                        onClick={() => {
                          if (confirm("Remove this character from the scene?")) {
                            removeCharacterFromScene(selectedId)
                          }
                        }}
                        className="bg-red-900/80 hover:bg-red-800 text-red-200 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Remove Character
                      </button>
                    )}

                    {/* Add character button */}
                    <button
                      onClick={() => setShowAddCharacterDialog(true)}
                      className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors"
                    >
                      <UserPlus className="w-3 h-3" />
                      Add Character
                    </button>

                  </div>

                  {/* Empty scene hint */}
                  {currentScene.characters.length === 0 && !isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 text-center pointer-events-auto">
                        <UserPlus className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                        <p className="text-slate-300 mb-2">No characters in scene</p>
                        <button
                          onClick={() => setShowAddCharacterDialog(true)}
                          className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm rounded-lg hover:opacity-90"
                        >
                          Add Your First Character
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Right-click context menu */}
                  {contextMenu && (
                    <div
                      className="fixed inset-0 z-50"
                      onClick={closeContextMenu}
                      onContextMenu={(e) => { e.preventDefault(); closeContextMenu() }}
                    >
                      <div
                        className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[180px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contextMenu.characterId ? (
                          <>
                            <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
                              {currentScene?.characters.find(c => c.id === contextMenu.characterId)?.name || 'Character'}
                            </div>
                            <button
                              className="w-full px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 text-left"
                              onClick={() => { addMovementKeyframe(contextMenu.characterId!, currentTime); closeContextMenu() }}
                            >
                              Add Movement Keyframe
                            </button>
                            <button
                              className="w-full px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 text-left"
                              onClick={() => { addAnimationKeyframe(contextMenu.characterId!, currentTime); closeContextMenu() }}
                            >
                              Add Animation Keyframe
                            </button>
                            <button
                              className="w-full px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 text-left"
                              onClick={() => {
                                setSelectedId(contextMenu.characterId)
                                setSelectionType('character')
                                setShowAddDialogueDialog(true)
                                setNewDialogueCharacterId(contextMenu.characterId!)
                                closeContextMenu()
                              }}
                            >
                              Add Dialogue
                            </button>
                            <div className="border-t border-slate-700 my-1" />
                            <button
                              className="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700 text-left"
                              onClick={() => {
                                if (confirm('Remove this character from the scene?')) {
                                  removeCharacterFromScene(contextMenu.characterId!)
                                }
                                closeContextMenu()
                              }}
                            >
                              Remove from Scene
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="w-full px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 text-left"
                              onClick={() => { addCameraKeyframe(currentTime); closeContextMenu() }}
                            >
                              Add Camera Keyframe
                            </button>
                            <button
                              className="w-full px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 text-left"
                              onClick={() => { setShowAddCharacterDialog(true); closeContextMenu() }}
                            >
                              Add Character
                            </button>
                            <button
                              className="w-full px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 text-left"
                              onClick={() => { setShowAddDialogueDialog(true); closeContextMenu() }}
                            >
                              Add Dialogue
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Subtitles */}
                  <SubtitleOverlay
                    dialogue={currentDialogue || null}
                    style="cinematic"
                    typewriterEffect={isPlaying}
                    typewriterSpeed={40}
                  />

                  {/* Character Action Panel - Gacha-style */}
                  {selectionType === 'character' && selectedCharacter && !isPlaying && (
                    <CharacterActionPanel
                      characterName={selectedCharacter.name}
                      characterId={selectedCharacter.id}
                      currentPose={selectedCharacter.animation?.basePose || null}
                      currentEmotion={selectedCharacter.animation?.emotion || null}
                      onChangePose={handleChangePose}
                      onChangeEmotion={handleChangeEmotion}
                      onAddDialogue={handleQuickAddDialogue}
                      onClose={() => handleSelect(null, null)}
                    />
                  )}

                  {/* Camera Action Panel */}
                  {selectionType === 'camera' && !isPlaying && (
                    <CameraActionPanel
                      currentFov={viewerRef.current?.getCameraState().fov || 50}
                      onApplyPreset={handleApplyCameraPreset}
                      onChangeFov={handleChangeFov}
                      onClose={() => handleSelect(null, null)}
                    />
                  )}
                </div>

                {/* Keyframe Properties Panel */}
                {selectedKeyframeId && selectedKeyframeType && (
                  <div className="w-72 border-l border-slate-700/50 bg-slate-800/80 overflow-y-auto">
                    <KeyframePropertiesPanel
                      keyframeType={selectedKeyframeType}
                      keyframeId={selectedKeyframeId}
                      duration={currentScene.duration}
                      characters={currentScene.characters}
                      cameraKeyframes={currentScene.cameraKeyframes || []}
                      movementKeyframes={currentScene.movementKeyframes || []}
                      animationKeyframes={currentScene.animationKeyframes || []}
                      dialogue={currentScene.dialogue}
                      onUpdateCameraKeyframe={updateCameraKeyframe}
                      onDeleteCameraKeyframe={deleteCameraKeyframe}
                      onUpdateMovementKeyframe={updateMovementKeyframe}
                      onDeleteMovementKeyframe={deleteMovementKeyframe}
                      onUpdateAnimationKeyframe={updateAnimationKeyframe}
                      onDeleteAnimationKeyframe={deleteAnimationKeyframe}
                      onUpdateDialogue={updateDialogue}
                      onDeleteDialogue={deleteDialogue}
                      onCaptureCameraPosition={captureCameraPosition}
                    />
                  </div>
                )}
              </div>

              {/* Bottom: Playback Controls + Timeline */}
              <div className="border-t border-slate-700">
                {/* Playback bar */}
                <div className="h-10 bg-slate-800 flex items-center gap-3 px-4 border-b border-slate-700/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRestart}
                    className="h-7 w-7"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handlePlayPause}
                    className="h-7 w-7"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <button
                    onClick={handleToggleRecord}
                    className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                      isRecording
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'text-slate-400 hover:text-red-400 hover:bg-slate-700/50'
                    }`}
                    title={isRecording ? 'Stop Recording' : 'Record Mode'}
                  >
                    <Circle className={`w-3 h-3 ${isRecording ? 'fill-current' : ''}`} />
                  </button>

                  <span className="text-sm text-slate-200 font-mono w-20">
                    {formatTime(currentTime)} / {formatTime(currentScene.duration)}
                  </span>

                  {/* Speed control */}
                  <div className="flex items-center gap-1 ml-2">
                    {[0.5, 1, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          playbackSpeed === speed
                            ? 'bg-sky-500/30 text-sky-300'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Loop toggle */}
                  <button
                    onClick={() => setLoopPlayback(!loopPlayback)}
                    className={`p-1 rounded transition-colors ${
                      loopPlayback
                        ? 'text-sky-400 bg-sky-500/20'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                    }`}
                    title={loopPlayback ? "Loop: On" : "Loop: Off"}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1" />

                  {/* Undo/Redo */}
                  <div className="flex items-center gap-0.5 mr-2">
                    <button
                      onClick={handleUndo}
                      disabled={undoStackRef.current.length === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={redoStackRef.current.length === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-xs text-slate-500">
                    {(currentScene.cameraKeyframes?.length || 0) + (currentScene.movementKeyframes?.length || 0) + (currentScene.animationKeyframes?.length || 0)} keyframes
                  </span>
                </div>

                {/* CapCut-style Timeline Editor */}
                <div className="h-64">
                  <TimelineEditor
                    duration={currentScene.duration}
                    currentTime={currentTime}
                    characters={currentScene.characters}
                    selectedCharacterId={selectionType === 'character' ? selectedId : null}
                    cameraKeyframes={currentScene.cameraKeyframes || []}
                    movementKeyframes={currentScene.movementKeyframes || []}
                    animationKeyframes={currentScene.animationKeyframes || []}
                    dialogue={currentScene.dialogue}
                    selectedKeyframeId={selectedKeyframeId}
                    selectedKeyframeType={selectedKeyframeType}
                    selectedKeyframeIds={selectedKeyframeIds}
                    onSeek={handleSeek}
                    onSelectKeyframe={handleSelectKeyframe}
                    onDurationChange={handleDurationChange}
                    onAddCameraKeyframe={addCameraKeyframe}
                    onUpdateCameraKeyframe={updateCameraKeyframe}
                    onDeleteCameraKeyframe={deleteCameraKeyframe}
                    onAddMovementKeyframe={addMovementKeyframe}
                    onUpdateMovementKeyframe={updateMovementKeyframe}
                    onDeleteMovementKeyframe={deleteMovementKeyframe}
                    onAddAnimationKeyframe={addAnimationKeyframe}
                    onUpdateAnimationKeyframe={updateAnimationKeyframe}
                    onDeleteAnimationKeyframe={deleteAnimationKeyframe}
                    onAddDialogue={() => setShowAddDialogueDialog(true)}
                    onUpdateDialogue={updateDialogue}
                    onDeleteDialogue={deleteDialogue}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
              <div className="text-center">
                <Film className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">
                  {scenes.length === 0
                    ? "Create your first scene to get started"
                    : "Select a scene from the sidebar"
                  }
                </p>
                {scenes.length === 0 && (
                  <Button onClick={createScene} className="bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:opacity-90">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Scene
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Feature Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-200">
              <Sparkles className="w-5 h-5 text-sky-500" />
              AI Scene Generation
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This feature is not implemented yet.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setShowAIDialog(false)} className="bg-sky-500 text-white hover:bg-sky-600">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Character Dialog */}
      <Dialog open={showAddCharacterDialog} onOpenChange={setShowAddCharacterDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-slate-200">Add Character to Scene</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a character from your story to add to this scene.
            </DialogDescription>
          </DialogHeader>
          {fullCharacterData.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">
              No characters created yet. Go to the Characters tab to create some!
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fullCharacterData.map((char) => {
                const alreadyInScene = currentScene?.characters.some(c => c.characterId === char.id)
                return (
                  <button
                    key={char.id}
                    onClick={() => addCharacterToScene(char.id)}
                    disabled={alreadyInScene}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      alreadyInScene
                        ? "border-slate-700 bg-slate-800 opacity-50 cursor-not-allowed text-slate-400"
                        : "border-slate-700 hover:border-sky-500 hover:bg-sky-500/10 text-slate-200"
                    }`}
                  >
                    <span className="font-medium">{char.name}</span>
                    {alreadyInScene && (
                      <span className="text-xs text-slate-500 ml-2">(already in scene)</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowAddCharacterDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Dialogue Dialog */}
      <Dialog open={showAddDialogueDialog} onOpenChange={setShowAddDialogueDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-slate-200">Add Dialogue</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a line of dialogue at the current time ({formatTime(currentTime)}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Character
              </label>
              <select
                value={newDialogueCharacterId}
                onChange={(e) => setNewDialogueCharacterId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-200"
              >
                <option value="">Select character...</option>
                {currentScene?.characters.map((char) => (
                  <option key={char.id} value={char.id}>{char.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Dialogue Text
              </label>
              <textarea
                value={newDialogueText}
                onChange={(e) => setNewDialogueText(e.target.value)}
                placeholder="What does the character say?"
                rows={3}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-200 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Duration (seconds)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={newDialogueDuration}
                onChange={(e) => setNewDialogueDuration(parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-200"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAddDialogueDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={addDialogue}
              disabled={!newDialogueCharacterId || !newDialogueText}
              className="bg-sky-500 text-white hover:bg-sky-600"
            >
              Add Dialogue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
