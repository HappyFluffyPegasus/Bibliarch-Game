"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
  User,
  Shirt,
  Scissors,
  Triangle,
  Footprints,
  Sparkles,
  Plus,
  Trash2,
  Shuffle,
  RotateCcw,
  PersonStanding,
  Link2,
  Unlink2,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useStoryStore } from "@/stores/storyStore"
import { HAIR_UNDERTONES } from "@/lib/hairTextures"
import { AVAILABLE_POSES } from "@/utils/animationLoader"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import ColorWheel from "@/components/characters/ColorWheel"
import TransformControls from "@/components/characters/TransformControls"
import ItemThumbnail from "@/components/characters/ItemThumbnail"
import { cn } from "@/lib/utils"

// Dynamically import Viewer3D to avoid SSR issues with Three.js
const Viewer3D = dynamic(
  () => import("@/components/characters/Viewer3D"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-200/60">Loading 3D viewer...</p>
        </div>
      </div>
    )
  }
)

type Category = 'HAIR' | 'TOPS' | 'DRESSES' | 'PANTS' | 'SHOES' | 'ACCESSORIES' | 'BODY' | 'POSES' | null

interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

interface CategoryColors {
  hair: string
  hairUndertone?: string
  tops: { primary: string; secondary?: string }
  pants: string
  dresses: string
  shoes: string
  socks: string
  accessories: string
  body: { skinTone: string; eyeColor: string }
}

interface MorphTargetInfo {
  meshName: string
  targetName: string
  index: number
}

interface CharacterData {
  id: string
  name: string
  visibleAssets: string[]
  colors: CategoryColors
  transforms?: Record<string, Transform>
  heightScale?: number
  morphTargets?: Record<string, number>
}

const DEFAULT_COLORS: CategoryColors = {
  hair: '#8B4513',
  hairUndertone: 'warm',
  tops: { primary: '#4A90E2', secondary: '#FFFFFF' },
  pants: '#2C3E50',
  dresses: '#E91E63',
  shoes: '#000000',
  socks: '#FFFFFF',
  accessories: '#FFD700',
  body: { skinTone: '#F5D6C6', eyeColor: '#4A90E2' }
}

const CATEGORIES = [
  { id: 'BODY' as const, icon: User, label: 'Body' },
  { id: 'HAIR' as const, icon: Scissors, label: 'Hair' },
  { id: 'TOPS' as const, icon: Shirt, label: 'Tops' },
  { id: 'DRESSES' as const, icon: Triangle, label: 'Dress' },
  { id: 'PANTS' as const, icon: Shirt, label: 'Pants' },
  { id: 'SHOES' as const, icon: Footprints, label: 'Shoes' },
  { id: 'ACCESSORIES' as const, icon: Sparkles, label: 'Extra' },
  { id: 'POSES' as const, icon: PersonStanding, label: 'Poses' }
]

const SECTION_RULES: Array<{ category: Category; keywords: string[] }> = [
  { category: 'BODY', keywords: ['skin', 'tone', 'body', 'plane072', 'mouth', 'eyebrow', 'brow', 'eye', 'iris'] },
  { category: 'HAIR', keywords: ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke', 'ahoge'] },
  { category: 'TOPS', keywords: ['shirt', 'tee', 'polo', 'sweater', 'jacket', 'tank', 'top', 'plane023'] },
  { category: 'DRESSES', keywords: ['dress'] },
  { category: 'PANTS', keywords: ['pants', 'jeans', 'short', 'skirt'] },
  { category: 'SHOES', keywords: ['shoe', 'boot', 'loafer', 'sneaker', 'mary', 'jane'] },
  { category: 'ACCESSORIES', keywords: ['glasses', 'hat', 'wing', 'sock', 'tight', 'stocking', 'accessory', 'warmer', 'leg warmer'] }
]

const HIDDEN_MESHES = ['Plane032_1', 'Plane023_1', 'Plane072', 'Plane072_1', 'Plane072_2', 'Eyes_1', 'Eyes_2', 'BézierCircle', 'BézierCircle001', 'NurbsPath052', 'NurbsPath013', 'eye whites', 'Eye Whites', 'eye_whites', 'Eye_Whites']

export function CharactersPage() {
  const params = useParams()
  const storyId = params.id as string
  const { stories, characterNoteLinks, linkCharacterToNote, unlinkCharacterFromNote, getCanvasData, saveCanvasData } = useStoryStore()
  const story = stories.find((s) => s.id === storyId)

  const [characters, setCharacters] = useState<CharacterData[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [currentCategory, setCurrentCategory] = useState<Category>(null)
  const [currentSubcategory, setCurrentSubcategory] = useState<string | null>(null)
  const [availableMeshes, setAvailableMeshes] = useState<string[]>([])
  const [availableMorphTargets, setAvailableMorphTargets] = useState<MorphTargetInfo[]>([])
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null)
  const [transformingMesh, setTransformingMesh] = useState<string | null>(null)
  const [selectedPose, setSelectedPose] = useState<string | null>(null)
  const [showLinkDialog, setShowLinkDialog] = useState<string | null>(null) // characterId to link

  const storyLinks = characterNoteLinks[storyId] || []

  const isCharacterLinked = (characterId: string) =>
    storyLinks.some(l => l.characterId === characterId)

  const handleLinkToNotes = (characterId: string, characterName: string) => {
    // Create a character node in the notes main canvas
    const mainCanvas = getCanvasData(storyId, 'main')
    const nodeId = `char-link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const existingNodes = mainCanvas?.nodes || []
    const newNode = {
      id: nodeId,
      x: 600 + Math.random() * 200,
      y: 100 + existingNodes.length * 80,
      text: characterName,
      width: 320,
      height: 72,
      type: 'character' as const,
    }
    saveCanvasData(storyId, 'main', [...existingNodes, newNode], mainCanvas?.connections || [])
    linkCharacterToNote(storyId, characterId, nodeId)
    setShowLinkDialog(null)
  }

  const handleUnlinkFromNotes = (characterId: string) => {
    if (confirm('Unlink this character from Notes?')) {
      unlinkCharacterFromNote(storyId, characterId)
    }
  }

  // Load characters and selected character from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`bibliarch-characters-${storyId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCharacters(parsed)
        const savedSelectedId = localStorage.getItem(`bibliarch-selected-char-${storyId}`)
        if (savedSelectedId && parsed.some((c: CharacterData) => c.id === savedSelectedId)) {
          setSelectedCharacterId(savedSelectedId)
        }
      } catch (e) {
        console.error('Failed to load characters:', e)
      }
    }
  }, [storyId])

  // Save characters to localStorage
  useEffect(() => {
    if (characters.length > 0) {
      localStorage.setItem(`bibliarch-characters-${storyId}`, JSON.stringify(characters))
    }
  }, [characters, storyId])

  // Save selected character ID to localStorage
  useEffect(() => {
    if (selectedCharacterId) {
      localStorage.setItem(`bibliarch-selected-char-${storyId}`, selectedCharacterId)
    }
  }, [selectedCharacterId, storyId])

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId)

  // Helper functions
  const matchesKeyword = (text: string, keywords: string[]): boolean => {
    const lower = text.toLowerCase()
    return keywords.some(kw => lower.includes(kw.toLowerCase()))
  }

  const categorizeMesh = useCallback((meshName: string): Category => {
    const lower = meshName.toLowerCase()
    if (lower === 'eye' || lower === 'iris') return 'BODY'
    if (lower.includes('mouth')) return 'BODY'
    if (lower.includes('brow')) return 'BODY'
    if (lower === 'body') return null

    for (const rule of SECTION_RULES) {
      if (matchesKeyword(meshName, rule.keywords)) {
        return rule.category
      }
    }
    return 'ACCESSORIES'
  }, [])

  const getSubcategory = useCallback((meshName: string): string => {
    const lower = meshName.toLowerCase()
    if (lower === 'eye' || lower === 'iris') return 'Eyes'
    if (matchesKeyword(meshName, ['eyebrow', 'brow'])) return 'Eyebrows'
    if (matchesKeyword(meshName, ['mouth'])) return 'Mouths'
    if (matchesKeyword(meshName, ['shirt', 'tee', 'polo', 'sweater', 'jacket', 'tank', 'plane023'])) return 'Shirts'
    if (matchesKeyword(meshName, ['dress'])) return 'Dresses'
    if (matchesKeyword(meshName, ['pants', 'jeans'])) return 'Pants'
    if (matchesKeyword(meshName, ['short'])) return 'Shorts'
    if (matchesKeyword(meshName, ['skirt'])) return 'Skirts'
    if (matchesKeyword(meshName, ['sock', 'tight', 'stocking', 'warmer', 'leg warmer'])) return 'Socks'
    if (matchesKeyword(meshName, ['glasses'])) return 'Glasses'

    const category = categorizeMesh(meshName)
    if (category === 'HAIR') return 'Hair'
    if (category === 'SHOES') return 'Shoes'
    if (category === 'ACCESSORIES') return 'Accessories'

    return 'Other'
  }, [categorizeMesh])

  const DEFAULT_BODY_ASSETS = ['Body', 'Chill Brows', 'Closed Mouth']

  // Character management
  const handleCreateCharacter = () => {
    const newCharacter: CharacterData = {
      id: `char_${Date.now()}`,
      name: `Character ${characters.length + 1}`,
      visibleAssets: [...DEFAULT_BODY_ASSETS],
      colors: { ...DEFAULT_COLORS }
    }
    setCharacters([...characters, newCharacter])
    setSelectedCharacterId(newCharacter.id)
    setCurrentCategory(null)
    // Prompt to link to Notes
    setShowLinkDialog(newCharacter.id)
  }

  const handleDeleteCharacter = (characterId: string) => {
    if (confirm('Delete this character?')) {
      setCharacters(characters.filter(c => c.id !== characterId))
      if (selectedCharacterId === characterId) {
        setSelectedCharacterId(null)
      }
    }
  }

  const handleUpdateCharacterName = (characterId: string, newName: string) => {
    setCharacters(characters.map(char =>
      char.id === characterId ? { ...char, name: newName } : char
    ))
  }

  // Asset management
  const toggleAsset = (meshName: string) => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char

      const isVisible = char.visibleAssets.includes(meshName)
      const newAssets = isVisible
        ? char.visibleAssets.filter(name => name !== meshName)
        : [...char.visibleAssets, meshName]

      return { ...char, visibleAssets: newAssets }
    }))
  }

  const selectBodyItem = (meshName: string, subcategory: string) => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char

      const subcategoryItems = availableMeshes.filter(mesh =>
        categorizeMesh(mesh) === 'BODY' && getSubcategory(mesh) === subcategory
      )

      const newAssets = char.visibleAssets.filter(asset => !subcategoryItems.includes(asset))
      newAssets.push(meshName)

      return { ...char, visibleAssets: newAssets }
    }))
  }

  const getSelectedBodyItem = (subcategory: string): string | null => {
    if (!selectedCharacter) return null

    const subcategoryItems = availableMeshes.filter(mesh =>
      categorizeMesh(mesh) === 'BODY' && getSubcategory(mesh) === subcategory
    )

    return selectedCharacter.visibleAssets.find(asset => subcategoryItems.includes(asset)) || null
  }

  const getBodySubcategoryItems = (subcategory: string): string[] => {
    return availableMeshes
      .filter(mesh => categorizeMesh(mesh) === 'BODY' && getSubcategory(mesh) === subcategory)
      .filter(mesh => !HIDDEN_MESHES.includes(mesh))
      .sort((a, b) => a.localeCompare(b))
  }

  // Color management
  const handleCategoryColorChange = (category: string, channel: string, color: string) => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char

      const newColors = { ...char.colors }

      if (channel === 'primary' && category === 'tops') {
        newColors.tops = { ...newColors.tops, primary: color }
      } else if (channel === 'secondary' && category === 'tops') {
        newColors.tops = { ...newColors.tops, secondary: color }
      } else if (category === 'body' && channel === 'skinTone') {
        newColors.body = { ...newColors.body, skinTone: color }
      } else if (category === 'body' && channel === 'eyeColor') {
        newColors.body = { ...newColors.body, eyeColor: color }
      } else {
        (newColors as any)[category] = color
      }

      return { ...char, colors: newColors }
    }))
  }

  const handleHeightScaleChange = (scale: number) => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char
      return { ...char, heightScale: scale }
    }))
  }

  const handleMorphTargetChange = (meshName: string, targetName: string, value: number) => {
    if (!selectedCharacterId) return

    const key = `${meshName}:${targetName}`
    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char
      return {
        ...char,
        morphTargets: {
          ...(char.morphTargets || {}),
          [key]: value
        }
      }
    }))
  }

  const handleResetAllMorphTargets = () => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char
      return { ...char, morphTargets: {} }
    }))
  }

  const handleTransformChange = (meshName: string, transform: Transform) => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char
      return { ...char, transforms: { ...char.transforms, [meshName]: transform } }
    }))
  }

  const handleTransformReset = (meshName: string) => {
    handleTransformChange(meshName, {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    })
  }

  const getTransformForMesh = (meshName: string): Transform => {
    if (!selectedCharacter?.transforms?.[meshName]) {
      return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
    }
    return selectedCharacter.transforms[meshName]
  }

  const getCategoryItems = (): string[] => {
    if (!currentCategory) return []

    const items = availableMeshes
      .filter(mesh => categorizeMesh(mesh) === currentCategory)
      .filter(mesh => !HIDDEN_MESHES.includes(mesh))

    const filtered = currentSubcategory
      ? items.filter(mesh => getSubcategory(mesh) === currentSubcategory)
      : items

    return filtered.sort((a, b) => a.localeCompare(b))
  }

  const getSubcategories = (): string[] => {
    if (!currentCategory) return []

    const items = availableMeshes.filter(mesh => categorizeMesh(mesh) === currentCategory)
    const subcats = [...new Set(items.map(mesh => getSubcategory(mesh)))]
    return subcats.sort()
  }

  const getCategoryColor = (category: Category, subcategory?: string | null): string => {
    if (!selectedCharacter || !category) return '#FFFFFF'

    if (subcategory === 'Socks') return selectedCharacter.colors.socks

    switch (category) {
      case 'HAIR': return selectedCharacter.colors.hair
      case 'TOPS': return selectedCharacter.colors.tops.primary
      case 'DRESSES': return selectedCharacter.colors.dresses
      case 'PANTS': return selectedCharacter.colors.pants
      case 'SHOES': return selectedCharacter.colors.shoes
      case 'ACCESSORIES': return selectedCharacter.colors.accessories
      case 'BODY': return selectedCharacter.colors.body.skinTone
      default: return '#FFFFFF'
    }
  }

  const meshColors = useMemo(() => {
    if (!selectedCharacter) return {}
    const colors: Record<string, string> = {}
    for (const meshName of availableMeshes) {
      const cat = categorizeMesh(meshName)
      if (!cat) continue
      const sub = getSubcategory(meshName)
      colors[meshName] = getCategoryColor(cat, sub)
    }
    return colors
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMeshes, selectedCharacter?.colors, categorizeMesh, getSubcategory])

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Far Left - Slim Character Avatar List (w-16) */}
      <aside className="w-16 bg-slate-800/60 backdrop-blur-sm border-r border-slate-700/50 flex flex-col items-center py-4 gap-2 pt-20">
        <button
          onClick={handleCreateCharacter}
          disabled={characters.length >= 20}
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            "bg-gradient-to-br from-sky-500 to-blue-600",
            "text-white shadow-lg shadow-sky-500/30",
            "transition-all duration-200 hover:scale-105 active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title="Create New Character"
        >
          <Plus size={24} />
        </button>

        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 py-2 scrollbar-thin">
          {characters.map((character) => (
            <div key={character.id} className="relative">
              <button
                onClick={() => setSelectedCharacterId(character.id)}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
                  selectedCharacterId === character.id
                    ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30 scale-105"
                    : "bg-slate-700/80 text-slate-200/60 hover:bg-slate-700 hover:shadow-md shadow-sky-500/10"
                )}
                title={character.name}
              >
                <User size={20} />
              </button>
              {isCharacterLinked(character.id) && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center" title="Linked to Notes">
                  <Link2 size={10} className="text-white" />
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedCharacter && (
          <button
            onClick={() => handleDeleteCharacter(selectedCharacter.id)}
            className="w-12 h-12 rounded-xl bg-slate-800/60 text-red-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 flex items-center justify-center"
          >
            <Trash2 size={18} />
          </button>
        )}
      </aside>

      {/* Center - Expanded 3D Viewer (flex-1) */}
      <main className="flex-1 relative">
        <Viewer3D
          currentSection={currentCategory}
          visibleAssets={selectedCharacter?.visibleAssets || []}
          categoryColors={selectedCharacter?.colors}
          meshColors={meshColors}
          transforms={selectedCharacter?.transforms}
          onMeshesLoaded={setAvailableMeshes}
          onMorphTargetsLoaded={setAvailableMorphTargets}
          morphTargetValues={selectedCharacter?.morphTargets}
          selectedPose={selectedPose}
          heightScale={selectedCharacter?.heightScale ?? 1.0}
        />

        {/* Empty State */}
        {!selectedCharacter && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700/80 shadow-lg shadow-sky-500/20 flex items-center justify-center">
                <User size={48} className="text-slate-200/30" />
              </div>
              <h2 className="text-xl font-semibold text-slate-200 mb-2">No Character Selected</h2>
              <p className="text-slate-200/60">Click + to create a character</p>
            </div>
          </div>
        )}

        {/* Character Name Input */}
        {selectedCharacter && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-lg shadow-sky-500/20 border border-slate-700">
            <input
              type="text"
              value={selectedCharacter.name}
              onChange={(e) => handleUpdateCharacterName(selectedCharacter.id, e.target.value)}
              className="bg-transparent text-slate-200 text-base font-medium outline-none w-44"
              placeholder="Character Name"
            />
            <button className="text-slate-200/40 hover:text-sky-400 transition-colors">
              <Shuffle size={16} />
            </button>
            {isCharacterLinked(selectedCharacter.id) ? (
              <button
                onClick={() => handleUnlinkFromNotes(selectedCharacter.id)}
                className="text-green-400 hover:text-red-400 transition-colors"
                title="Unlink from Notes"
              >
                <Unlink2 size={16} />
              </button>
            ) : (
              <button
                onClick={() => handleLinkToNotes(selectedCharacter.id, selectedCharacter.name)}
                className="text-slate-200/40 hover:text-sky-400 transition-colors"
                title="Link to Notes"
              >
                <Link2 size={16} />
              </button>
            )}
          </div>
        )}

        {/* Transform Controls Overlay */}
        {transformingMesh && selectedCharacter && (
          <TransformControls
            meshName={transformingMesh}
            currentTransform={getTransformForMesh(transformingMesh)}
            onTransformChange={(transform) => handleTransformChange(transformingMesh, transform)}
            onClose={() => setTransformingMesh(null)}
            onReset={() => handleTransformReset(transformingMesh)}
          />
        )}
      </main>

      {/* Right Panel - Category Icons + Options (w-96) */}
      <aside className="w-96 bg-slate-800/40 backdrop-blur-sm border-l border-slate-700/30 flex flex-col">
        {/* Big Category Icon Grid */}
        <div className="p-4 border-b border-slate-700/30">
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => {
              const IconComponent = cat.icon
              const isSelected = currentCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (!selectedCharacter) return
                    setCurrentCategory(isSelected ? null : cat.id)
                    setCurrentSubcategory(null)
                  }}
                  disabled={!selectedCharacter}
                  className={cn(
                    "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 p-2",
                    "transition-all duration-200",
                    isSelected
                      ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30 scale-105"
                      : "bg-slate-700/80 text-slate-200 hover:bg-slate-700 hover:shadow-md shadow-sky-500/10",
                    !selectedCharacter && "opacity-50 cursor-not-allowed"
                  )}
                  title={cat.label}
                >
                  <IconComponent size={28} />
                  <span className="text-[10px] font-medium">{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrollable Options Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedCharacter ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/60 flex items-center justify-center">
                <User size={40} className="text-slate-200/30" />
              </div>
              <p className="text-slate-200/60 text-sm">Create a character to start</p>
            </div>
          ) : !currentCategory ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/60 flex items-center justify-center">
                <Sparkles size={40} className="text-sky-400/50" />
              </div>
              <p className="text-slate-200/60 text-sm">Select a category above</p>
            </div>
          ) : currentCategory === 'BODY' ? (
            /* BODY Category Options */
            <div className="space-y-4">
              {/* Skin Tone */}
              <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Skin Tone</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setColorPickerOpen('body-skin')}
                      className="w-10 h-10 rounded-xl border-2 border-slate-700/50 shadow-inner"
                      style={{ backgroundColor: selectedCharacter.colors.body.skinTone }}
                    />
                    <button
                      onClick={() => handleCategoryColorChange('body', 'skinTone', DEFAULT_COLORS.body.skinTone)}
                      className="w-8 h-8 rounded-lg bg-slate-700/80 text-slate-200/50 hover:text-sky-400 transition-colors flex items-center justify-center"
                      title="Reset color"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Height Slider */}
              <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-200">Height</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-200/60 bg-slate-700/80 px-2 py-1 rounded-lg">
                      {Math.round((selectedCharacter.heightScale ?? 1.0) * 100)}%
                    </span>
                    <button
                      onClick={() => handleHeightScaleChange(1.0)}
                      className="w-8 h-8 rounded-lg bg-slate-700/80 text-slate-200/50 hover:text-sky-400 transition-colors flex items-center justify-center"
                      title="Reset height"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
                <Slider
                  value={[(selectedCharacter.heightScale ?? 1.0) * 100]}
                  onValueChange={(value) => handleHeightScaleChange(value[0] / 100)}
                  min={80}
                  max={120}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-200/40 mt-2">
                  <span>Short</span>
                  <span>Tall</span>
                </div>
              </div>

              {/* Eye Controls (Shape Keys) */}
              {availableMorphTargets.length > 0 && (
                <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-200">Eye Controls</span>
                    <button
                      onClick={handleResetAllMorphTargets}
                      className="text-xs text-slate-200/50 hover:text-sky-400 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      Reset
                    </button>
                  </div>
                  <div className="space-y-3">
                    {availableMorphTargets.map((target) => {
                      const key = `${target.meshName}:${target.targetName}`
                      const value = selectedCharacter.morphTargets?.[key] ?? 0
                      const displayName = target.targetName

                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-200/60 truncate flex-1 mr-2">
                              {displayName}
                            </span>
                            <span className="text-[10px] text-slate-200/40 w-8 text-right">
                              {Math.round(value * 100)}%
                            </span>
                          </div>
                          <Slider
                            value={[value * 100]}
                            onValueChange={(v) => handleMorphTargetChange(target.meshName, target.targetName, v[0] / 100)}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Eyes Selector (legacy mesh-based eyes, if any exist) */}
              {getBodySubcategoryItems('Eyes').length > 0 && <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <h4 className="text-sm font-medium text-slate-200 mb-3">Eyes</h4>
                <div className="grid grid-cols-4 gap-2">
                  {getBodySubcategoryItems('Eyes').map((meshName) => {
                    const isSelected = getSelectedBodyItem('Eyes') === meshName
                    return (
                      <button
                        key={meshName}
                        onClick={() => selectBodyItem(meshName, 'Eyes')}
                        className={cn(
                          "aspect-square rounded-xl border-2 transition-all overflow-hidden",
                          isSelected
                            ? "border-sky-500 ring-2 ring-sky-500/30 scale-105"
                            : "border-slate-700/50 hover:border-sky-500/50 bg-slate-700/50"
                        )}
                        title={meshName}
                      >
                        <ItemThumbnail meshName={meshName} color={selectedCharacter.colors.body.eyeColor} />
                      </button>
                    )
                  })}
                </div>
              </div>}

              {/* Eyebrows Selector */}
              <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <h4 className="text-sm font-medium text-slate-200 mb-3">Eyebrows</h4>
                <div className="grid grid-cols-4 gap-2">
                  {getBodySubcategoryItems('Eyebrows').map((meshName) => {
                    const isSelected = getSelectedBodyItem('Eyebrows') === meshName
                    return (
                      <button
                        key={meshName}
                        onClick={() => selectBodyItem(meshName, 'Eyebrows')}
                        className={cn(
                          "aspect-square rounded-xl border-2 transition-all overflow-hidden",
                          isSelected
                            ? "border-sky-500 ring-2 ring-sky-500/30 scale-105"
                            : "border-slate-700/50 hover:border-sky-500/50 bg-slate-700/50"
                        )}
                        title={meshName}
                      >
                        <ItemThumbnail meshName={meshName} color={selectedCharacter.colors.hair} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mouths Selector */}
              <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <h4 className="text-sm font-medium text-slate-200 mb-3">Mouth</h4>
                <div className="grid grid-cols-4 gap-2">
                  {getBodySubcategoryItems('Mouths').map((meshName) => {
                    const isSelected = getSelectedBodyItem('Mouths') === meshName
                    return (
                      <button
                        key={meshName}
                        onClick={() => selectBodyItem(meshName, 'Mouths')}
                        className={cn(
                          "aspect-square rounded-xl border-2 transition-all overflow-hidden",
                          isSelected
                            ? "border-sky-500 ring-2 ring-sky-500/30 scale-105"
                            : "border-slate-700/50 hover:border-sky-500/50 bg-slate-700/50"
                        )}
                        title={meshName}
                      >
                        <ItemThumbnail meshName={meshName} color={selectedCharacter.colors.body.skinTone} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : currentCategory === 'POSES' ? (
            /* POSES Category Options */
            <div className="space-y-4">
              <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <h4 className="text-sm font-medium text-slate-200 mb-3">Animation Poses</h4>
                <div className="grid grid-cols-2 gap-2">
                  {/* No Animation / T-Pose */}
                  <button
                    onClick={() => setSelectedPose(null)}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      !selectedPose
                        ? "border-sky-500 bg-gradient-to-br from-sky-500/20 to-blue-600/20 ring-2 ring-sky-500/30"
                        : "border-slate-700/50 bg-slate-700/50 hover:border-sky-500/50 hover:bg-slate-700"
                    )}
                  >
                    <PersonStanding size={32} className="text-slate-200" />
                    <span className="text-xs text-slate-200 font-medium">T-Pose</span>
                  </button>

                  {/* Available Animations */}
                  {AVAILABLE_POSES.map((pose) => (
                    <button
                      key={pose.id}
                      onClick={() => setSelectedPose(pose.id)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                        selectedPose === pose.id
                          ? "border-sky-500 bg-gradient-to-br from-sky-500/20 to-blue-600/20 ring-2 ring-sky-500/30"
                          : "border-slate-700/50 bg-slate-700/50 hover:border-sky-500/50 hover:bg-slate-700"
                      )}
                    >
                      <PersonStanding size={32} className="text-slate-200" />
                      <span className="text-xs text-slate-200 font-medium text-center">{pose.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedPose && (
                <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                  <div className="flex items-center gap-2 text-sm text-slate-200/60">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Playing: {AVAILABLE_POSES.find(p => p.id === selectedPose)?.name}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Other Categories */
            <>
              {/* Subcategory Filter Pills */}
              {getSubcategories().length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setCurrentSubcategory(null)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      !currentSubcategory
                        ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30"
                        : "bg-slate-700/80 text-slate-200/70 hover:bg-slate-700 hover:shadow-sm"
                    )}
                  >
                    All
                  </button>
                  {getSubcategories().map((subcat) => (
                    <button
                      key={subcat}
                      onClick={() => setCurrentSubcategory(currentSubcategory === subcat ? null : subcat)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        currentSubcategory === subcat
                          ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30"
                          : "bg-slate-700/80 text-slate-200/70 hover:bg-slate-700 hover:shadow-sm"
                      )}
                    >
                      {subcat}
                    </button>
                  ))}
                </div>
              )}

              {/* Color Picker Card */}
              <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Color</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setColorPickerOpen(currentCategory?.toLowerCase() || null)}
                      className="w-10 h-10 rounded-xl border-2 border-slate-700/50 shadow-inner"
                      style={{ backgroundColor: getCategoryColor(currentCategory, currentSubcategory) }}
                    />
                    <button
                      onClick={() => {
                        const cat = currentCategory?.toLowerCase()
                        if (cat && cat in DEFAULT_COLORS) {
                          const defaultVal = (DEFAULT_COLORS as any)[cat]
                          if (typeof defaultVal === 'string') {
                            handleCategoryColorChange(cat, 'primary', defaultVal)
                          } else if (defaultVal?.primary) {
                            handleCategoryColorChange(cat, 'primary', defaultVal.primary)
                          }
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-700/80 text-slate-200/50 hover:text-sky-400 transition-colors flex items-center justify-center"
                      title="Reset color"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Hair Undertone Picker */}
              {currentCategory === 'HAIR' && (
                <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                  <span className="text-sm font-medium text-slate-200 block mb-3">Undertone</span>
                  <div className="grid grid-cols-5 gap-2">
                    {HAIR_UNDERTONES.map((undertone) => (
                      <button
                        key={undertone.id}
                        onClick={() => {
                          if (!selectedCharacter) return
                          const updated = {
                            ...selectedCharacter,
                            colors: { ...selectedCharacter.colors, hairUndertone: undertone.id }
                          }
                          setCharacters(prev => prev.map(c => c.id === selectedCharacter.id ? updated : c))
                        }}
                        className={cn(
                          "aspect-square rounded-xl border-2 transition-all",
                          selectedCharacter?.colors.hairUndertone === undertone.id
                            ? "border-sky-500 ring-2 ring-sky-500/30 scale-105"
                            : "border-slate-700/50 hover:border-sky-500/50"
                        )}
                        style={{ backgroundColor: undertone.previewColor }}
                        title={undertone.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Items Grid */}
              <div className="bg-slate-700/80 rounded-2xl p-4 shadow-sm shadow-sky-500/20">
                <div className="grid grid-cols-3 gap-2">
                  {getCategoryItems().map((meshName) => {
                    const isSelected = selectedCharacter.visibleAssets.includes(meshName)
                    return (
                      <button
                        key={meshName}
                        onClick={() => toggleAsset(meshName)}
                        className={cn(
                          "aspect-square rounded-xl border-2 transition-all overflow-hidden",
                          isSelected
                            ? "border-sky-500 ring-2 ring-sky-500/30 scale-105"
                            : "border-slate-700/50 bg-slate-700/50 hover:border-sky-500/50"
                        )}
                        title={meshName}
                      >
                        <ItemThumbnail
                          meshName={meshName}
                          color={getCategoryColor(currentCategory, currentSubcategory)}
                        />
                      </button>
                    )
                  })}
                </div>

                {getCategoryItems().length === 0 && (
                  <div className="text-center py-8 text-slate-200/40">
                    <p className="text-sm">No items in this category</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Link to Notes Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Link to Notes?</h3>
            <p className="text-sm text-slate-400 mb-5">
              Would you like to add this character to the Notes tab as a character node?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLinkDialog(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={() => {
                  const char = characters.find(c => c.id === showLinkDialog)
                  if (char) handleLinkToNotes(char.id, char.name)
                }}
                className="px-4 py-2 rounded-lg text-sm bg-sky-500 text-white hover:bg-sky-600 transition-colors"
              >
                Yes, link to Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color Picker Modal */}
      {colorPickerOpen && selectedCharacter && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="max-w-sm w-full mx-4">
            <ColorWheel
              currentColor={
                colorPickerOpen === 'body-skin'
                  ? selectedCharacter.colors.body.skinTone
                  : colorPickerOpen === 'body-eyes'
                  ? selectedCharacter.colors.body.eyeColor
                  : getCategoryColor(currentCategory, currentSubcategory)
              }
              onChange={(color) => {
                if (colorPickerOpen === 'body-skin') {
                  handleCategoryColorChange('body', 'skinTone', color)
                } else if (colorPickerOpen === 'body-eyes') {
                  handleCategoryColorChange('body', 'eyeColor', color)
                } else {
                  const cat = currentCategory?.toLowerCase()
                  if (cat) {
                    handleCategoryColorChange(cat, 'primary', color)
                  }
                }
              }}
              onClose={() => setColorPickerOpen(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
