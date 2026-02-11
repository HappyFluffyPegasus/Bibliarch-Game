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
  MessageSquare,
  Sparkles,
  UserPlus,
  Save,
  ChevronRight,
  X,
  Move,
  Settings2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SceneCharacter, DialogueLine, CharacterData, TransformGizmoMode } from "@/types/scenes"
import CharacterTransformPanel from "@/components/scenes/CharacterTransformPanel"

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

interface Scene {
  id: string
  title: string
  characters: SceneCharacter[]
  dialogue: DialogueLine[]
  duration: number // in seconds
  linkedTimelineEventId?: string
  locationId?: string // For world backdrop (Phase 3)
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function ScenesPage() {
  const params = useParams()
  const storyId = params.id as string

  // Scenes state
  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Scene editor state
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [gizmoMode, setGizmoMode] = useState<TransformGizmoMode>('translate')

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const playbackRef = useRef<number | null>(null)

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

  // Load data on mount
  useEffect(() => {
    // Load scenes
    const savedScenes = localStorage.getItem(`bibliarch-scenes-${storyId}`)
    if (savedScenes) {
      try {
        const parsed = JSON.parse(savedScenes)
        setScenes(parsed)
        if (parsed.length > 0) {
          setSelectedSceneId(parsed[0].id)
        }
      } catch (e) {
        console.error("Failed to load scenes:", e)
      }
    }

    // Load full character data (not just basic info)
    const savedCharacters = localStorage.getItem(`bibliarch-characters-${storyId}`)
    if (savedCharacters) {
      try {
        setFullCharacterData(JSON.parse(savedCharacters))
      } catch (e) {
        console.error("Failed to load characters:", e)
      }
    }
  }, [storyId])

  // Save scenes
  const saveScenes = useCallback(() => {
    localStorage.setItem(`bibliarch-scenes-${storyId}`, JSON.stringify(scenes))
    setHasUnsavedChanges(false)
  }, [storyId, scenes])

  // Auto-save
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const timeout = setTimeout(saveScenes, 2000)
    return () => clearTimeout(timeout)
  }, [hasUnsavedChanges, saveScenes])

  // Get current scene
  const currentScene = scenes.find(s => s.id === selectedSceneId)

  // Get selected scene character
  const selectedSceneCharacter = currentScene?.characters.find(c => c.id === selectedCharacterId)

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !currentScene) return

    const startTime = Date.now() - currentTime * 1000
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000
      if (elapsed >= currentScene.duration) {
        setCurrentTime(currentScene.duration)
        setIsPlaying(false)
        return
      }
      setCurrentTime(elapsed)
      playbackRef.current = requestAnimationFrame(animate)
    }

    playbackRef.current = requestAnimationFrame(animate)

    return () => {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current)
      }
    }
  }, [isPlaying, currentScene])

  // Get current dialogue for subtitle
  const currentDialogue = currentScene?.dialogue.find(d =>
    currentTime >= d.startTime && currentTime < d.startTime + d.duration
  )

  // Scene operations
  const createScene = useCallback(() => {
    const newScene: Scene = {
      id: generateId(),
      title: `Scene ${scenes.length + 1}`,
      characters: [],
      dialogue: [],
      duration: 10
    }
    setScenes(prev => [...prev, newScene])
    setSelectedSceneId(newScene.id)
    setHasUnsavedChanges(true)
  }, [scenes.length])

  const deleteScene = useCallback((id: string) => {
    if (!confirm("Delete this scene?")) return
    setScenes(prev => prev.filter(s => s.id !== id))
    if (selectedSceneId === id) {
      setSelectedSceneId(scenes.find(s => s.id !== id)?.id || null)
    }
    setHasUnsavedChanges(true)
  }, [selectedSceneId, scenes])

  const updateSceneTitle = useCallback((id: string, title: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, title } : s))
    setHasUnsavedChanges(true)
  }, [])

  const updateSceneDuration = useCallback((id: string, duration: number) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, duration } : s))
    setHasUnsavedChanges(true)
  }, [])

  // Character operations
  const addCharacterToScene = useCallback((characterId: string) => {
    if (!currentScene) return
    const char = fullCharacterData.find(c => c.id === characterId)
    if (!char) return

    // Check if already in scene
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

    setScenes(prev => prev.map(s =>
      s.id === currentScene.id
        ? { ...s, characters: [...s.characters, sceneChar] }
        : s
    ))
    setShowAddCharacterDialog(false)
    setHasUnsavedChanges(true)
  }, [currentScene, fullCharacterData])

  const removeCharacterFromScene = useCallback((sceneCharId: string) => {
    if (!currentScene) return
    setScenes(prev => prev.map(s =>
      s.id === currentScene.id
        ? {
            ...s,
            characters: s.characters.filter(c => c.id !== sceneCharId),
            dialogue: s.dialogue.filter(d => d.characterId !== sceneCharId)
          }
        : s
    ))
    if (selectedCharacterId === sceneCharId) {
      setSelectedCharacterId(null)
    }
    setHasUnsavedChanges(true)
  }, [currentScene, selectedCharacterId])

  const moveCharacter = useCallback((sceneCharId: string, position: [number, number, number], rotation: number) => {
    if (!currentScene) return
    setScenes(prev => prev.map(s =>
      s.id === currentScene.id
        ? {
            ...s,
            characters: s.characters.map(c =>
              c.id === sceneCharId ? { ...c, position, rotation } : c
            )
          }
        : s
    ))
    setHasUnsavedChanges(true)
  }, [currentScene])

  // Update position only
  const updateCharacterPosition = useCallback((position: [number, number, number]) => {
    if (!selectedCharacterId || !currentScene) return
    const char = currentScene.characters.find(c => c.id === selectedCharacterId)
    if (char) {
      moveCharacter(selectedCharacterId, position, char.rotation)
    }
  }, [selectedCharacterId, currentScene, moveCharacter])

  // Update rotation only
  const updateCharacterRotation = useCallback((rotation: number) => {
    if (!selectedCharacterId || !currentScene) return
    const char = currentScene.characters.find(c => c.id === selectedCharacterId)
    if (char) {
      moveCharacter(selectedCharacterId, char.position, rotation)
    }
  }, [selectedCharacterId, currentScene, moveCharacter])

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
      startTime: currentScene.dialogue.length > 0
        ? Math.max(...currentScene.dialogue.map(d => d.startTime + d.duration))
        : 0,
      duration: newDialogueDuration
    }

    // Extend scene duration if needed
    const endTime = newDialogue.startTime + newDialogue.duration
    const newDuration = Math.max(currentScene.duration, endTime + 1)

    setScenes(prev => prev.map(s =>
      s.id === currentScene.id
        ? { ...s, dialogue: [...s.dialogue, newDialogue], duration: newDuration }
        : s
    ))

    setShowAddDialogueDialog(false)
    setNewDialogueCharacterId("")
    setNewDialogueText("")
    setNewDialogueDuration(3)
    setHasUnsavedChanges(true)
  }, [currentScene, newDialogueCharacterId, newDialogueText, newDialogueDuration])

  const deleteDialogue = useCallback((dialogueId: string) => {
    if (!currentScene) return
    setScenes(prev => prev.map(s =>
      s.id === currentScene.id
        ? { ...s, dialogue: s.dialogue.filter(d => d.id !== dialogueId) }
        : s
    ))
    setHasUnsavedChanges(true)
  }, [currentScene])

  // Playback controls
  const handlePlayPause = useCallback(() => {
    if (!currentScene) return
    if (isPlaying) {
      setIsPlaying(false)
    } else {
      if (currentTime >= currentScene.duration) {
        setCurrentTime(0)
      }
      setIsPlaying(true)
    }
  }, [isPlaying, currentTime, currentScene])

  const handleRestart = useCallback(() => {
    setCurrentTime(0)
    setIsPlaying(false)
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
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
            {hasUnsavedChanges && (
              <span className="text-xs text-amber-500">Unsaved</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAIDialog(true)} className="bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate with AI
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={saveScenes}
              disabled={!hasUnsavedChanges}
              className="bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-sky-500/30"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button size="sm" onClick={createScene} className="bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-sky-500/30">
              <Plus className="w-4 h-4 mr-2" />
              New Scene
            </Button>
          </div>
        </div>
      </header>

      {/* Scene Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Scene List Sidebar */}
        <div className="w-52 border-r border-slate-700/50 bg-slate-800/60 backdrop-blur-sm flex flex-col">
          <div className="p-3 border-b border-slate-700/30">
            <h3 className="text-sm font-medium text-slate-400">
              Scenes
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {scenes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No scenes yet
              </p>
            ) : (
              <ul className="space-y-1">
                {scenes.map((scene) => (
                  <li
                    key={scene.id}
                    onClick={() => {
                      setSelectedSceneId(scene.id)
                      setSelectedCharacterId(null)
                      setCurrentTime(0)
                      setIsPlaying(false)
                    }}
                    className={`group px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between transition-colors ${
                      selectedSceneId === scene.id
                        ? "bg-sky-500/20 text-sky-300"
                        : "hover:bg-slate-700/50 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight className={`w-3 h-3 flex-shrink-0 ${
                        selectedSceneId === scene.id ? "text-sky-400" : "text-slate-500"
                      }`} />
                      <span className="truncate">{scene.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteScene(scene.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 3D Scene View */}
        <div className="flex-1 flex flex-col">
          {/* 3D Viewport */}
          <div className="flex-1 relative">
            {currentScene ? (
              <>
                <SceneViewer3D
                  characters={currentScene.characters}
                  characterDataMap={characterDataMap}
                  selectedCharacterId={selectedCharacterId}
                  onSelectCharacter={setSelectedCharacterId}
                  onMoveCharacter={moveCharacter}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  gizmoMode={gizmoMode}
                  onGizmoModeChange={setGizmoMode}
                />

                {/* Mode indicator */}
                <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                  {isPlaying ? (
                    "Playing..."
                  ) : selectedCharacterId ? (
                    <>
                      <Move className="w-3 h-3" />
                      Use gizmo to transform | G: Move | R: Rotate | S: Scale
                    </>
                  ) : (
                    "Click character to select"
                  )}
                </div>

                {/* Subtitles */}
                {currentDialogue && (
                  <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-xl">
                    <div className="bg-black/80 text-white px-6 py-3 rounded-lg text-center">
                      <p className="text-xs text-sky-400 mb-1">{currentDialogue.characterName}</p>
                      <p className="text-sm">{currentDialogue.text}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
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

          {/* Playback Controls */}
          <div className="h-16 border-t border-slate-700 bg-slate-800 flex items-center gap-4 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRestart}
              disabled={!currentScene}
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              onClick={handlePlayPause}
              disabled={!currentScene}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            {/* Timeline scrubber */}
            <div className="flex-1 max-w-lg">
              <input
                type="range"
                min={0}
                max={currentScene?.duration || 10}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                disabled={!currentScene}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <span className="text-sm text-slate-400 w-24 text-right">
              {formatTime(currentTime)} / {formatTime(currentScene?.duration || 0)}
            </span>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-72 border-l border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
          {currentScene ? (
            <>
              <div className="p-4 border-b border-slate-700">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Scene Title
                </label>
                <input
                  type="text"
                  value={currentScene.title}
                  onChange={(e) => updateSceneTitle(currentScene.id, e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-slate-600 rounded bg-slate-900 text-slate-200"
                />
              </div>

              <div className="p-4 border-b border-slate-700">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={currentScene.duration}
                  onChange={(e) => updateSceneDuration(currentScene.id, parseInt(e.target.value) || 10)}
                  className="w-full px-2 py-1 text-sm border border-slate-600 rounded bg-slate-900 text-slate-200"
                />
              </div>

              {/* Characters section */}
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-slate-400">
                    Characters ({currentScene.characters.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddCharacterDialog(true)}
                    className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
                {currentScene.characters.length === 0 ? (
                  <p className="text-xs text-slate-500">No characters in scene</p>
                ) : (
                  <ul className="space-y-1">
                    {currentScene.characters.map((char) => {
                      // Get hair color from full character data for indicator
                      const fullData = characterDataMap.get(char.characterId)
                      const indicatorColor = fullData?.colors?.hair || '#888888'

                      return (
                        <li
                          key={char.id}
                          onClick={() => setSelectedCharacterId(char.id)}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer ${
                            selectedCharacterId === char.id
                              ? "bg-sky-500/20"
                              : "hover:bg-slate-700/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: indicatorColor }}
                            />
                            <span className="text-slate-200">{char.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeCharacterFromScene(char.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Transform panel for selected character */}
              {selectedCharacterId && (
                <div className="border-b border-slate-700">
                  <div className="px-4 py-2 bg-slate-700/30 flex items-center gap-2">
                    <Settings2 className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-medium text-slate-400">Transform</span>
                  </div>
                  <CharacterTransformPanel
                    character={selectedSceneCharacter || null}
                    gizmoMode={gizmoMode}
                    onGizmoModeChange={setGizmoMode}
                    onPositionChange={updateCharacterPosition}
                    onRotationChange={updateCharacterRotation}
                  />
                </div>
              )}

              {/* Dialogue section */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-slate-400">
                    Dialogue ({currentScene.dialogue.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddDialogueDialog(true)}
                    disabled={currentScene.characters.length === 0}
                    className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
                {currentScene.dialogue.length === 0 ? (
                  <p className="text-xs text-slate-500">No dialogue yet</p>
                ) : (
                  <ul className="space-y-2">
                    {currentScene.dialogue.map((line) => (
                      <li
                        key={line.id}
                        className={`group p-2 rounded border text-xs ${
                          currentDialogue?.id === line.id
                            ? "border-sky-500 bg-sky-500/20"
                            : "border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-300">
                            {line.characterName}
                          </span>
                          <button
                            onClick={() => deleteDialogue(line.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-slate-400 mb-1">{line.text}</p>
                        <p className="text-slate-500">
                          {formatTime(line.startTime)} - {formatTime(line.startTime + line.duration)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-slate-500 text-sm">
              Select a scene to edit
            </div>
          )}
        </div>
      </div>

      {/* AI Feature Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-500" />
              AI Scene Generation
            </DialogTitle>
            <DialogDescription>
              This feature is not implemented yet.
              <br /><br />
              When complete, AI will be able to:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Generate scenes from timeline events</li>
                <li>Create dialogue based on character personalities</li>
                <li>Suggest camera angles and movements</li>
                <li>Fill in minor scenes between major plot points</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setShowAIDialog(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Character Dialog */}
      <Dialog open={showAddCharacterDialog} onOpenChange={setShowAddCharacterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Character to Scene</DialogTitle>
            <DialogDescription>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Dialogue</DialogTitle>
            <DialogDescription>
              Add a line of dialogue to the scene.
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
            >
              Add Dialogue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
