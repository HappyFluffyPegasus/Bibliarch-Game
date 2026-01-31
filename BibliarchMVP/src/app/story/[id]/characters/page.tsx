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
  RotateCcw
} from "lucide-react"
import dynamic from "next/dynamic"
import { useStoryStore } from "@/stores/storyStore"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import ColorWheel from "@/components/characters/ColorWheel"
import TransformControls from "@/components/characters/TransformControls"
import ItemThumbnail from "@/components/characters/ItemThumbnail"

// Dynamically import Viewer3D to avoid SSR issues with Three.js
const Viewer3D = dynamic(
  () => import("@/components/characters/Viewer3D"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading 3D viewer...</p>
        </div>
      </div>
    )
  }
)

type Category = 'HAIR' | 'TOPS' | 'DRESSES' | 'PANTS' | 'SHOES' | 'ACCESSORIES' | 'BODY' | null

interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

interface CategoryColors {
  hair: string
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
  heightScale?: number // 0.8 to 1.2, default 1.0
  morphTargets?: Record<string, number> // key: "meshName:targetName", value: 0-1
}

const DEFAULT_COLORS: CategoryColors = {
  hair: '#8B4513',
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
  { id: 'DRESSES' as const, icon: Triangle, label: 'Dresses' },
  { id: 'PANTS' as const, icon: Shirt, label: 'Pants' },
  { id: 'SHOES' as const, icon: Footprints, label: 'Shoes' },
  { id: 'ACCESSORIES' as const, icon: Sparkles, label: 'Extras' }
]

const SECTION_RULES: Array<{ category: Category; keywords: string[] }> = [
  { category: 'BODY', keywords: ['skin', 'tone', 'body', 'plane072', 'mouth', 'eyebrow', 'brow', 'eyes'] },
  { category: 'HAIR', keywords: ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke'] },
  { category: 'TOPS', keywords: ['shirt', 'tee', 'polo', 'sweater', 'jacket', 'tank', 'top', 'plane023'] },
  { category: 'DRESSES', keywords: ['dress'] },
  { category: 'PANTS', keywords: ['pants', 'jeans', 'short', 'skirt'] },
  { category: 'SHOES', keywords: ['shoe', 'boot', 'loafer', 'sneaker', 'mary', 'jane'] },
  { category: 'ACCESSORIES', keywords: ['glasses', 'hat', 'wing', 'sock', 'tight', 'stocking', 'accessory', 'warmer', 'leg warmer'] }
]

const HIDDEN_MESHES = ['Plane032_1', 'Plane023_1', 'Plane072', 'Plane072_1', 'Plane072_2', 'Eyes_1', 'Eyes_2']

export default function CharactersPage() {
  const params = useParams()
  const storyId = params.id as string
  const { stories } = useStoryStore()
  const story = stories.find((s) => s.id === storyId)

  const [characters, setCharacters] = useState<CharacterData[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [currentCategory, setCurrentCategory] = useState<Category>(null)
  const [currentSubcategory, setCurrentSubcategory] = useState<string | null>(null)
  const [availableMeshes, setAvailableMeshes] = useState<string[]>([])
  const [availableMorphTargets, setAvailableMorphTargets] = useState<MorphTargetInfo[]>([])
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null)
  const [transformingMesh, setTransformingMesh] = useState<string | null>(null)

  // Load characters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`bibliarch-characters-${storyId}`)
    if (saved) {
      try {
        setCharacters(JSON.parse(saved))
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

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId)

  // Helper functions
  const matchesKeyword = (text: string, keywords: string[]): boolean => {
    const lower = text.toLowerCase()
    return keywords.some(kw => lower.includes(kw.toLowerCase()))
  }

  const categorizeMesh = useCallback((meshName: string): Category => {
    const lower = meshName.toLowerCase()
    // Eyes are part of BODY
    if (meshName === 'Eyes' || meshName === 'Eyes_3' || lower === 'eyes') return 'BODY'
    // Mouths and eyebrows are part of BODY
    if (lower.includes('mouth')) return 'BODY'
    if (lower.includes('brow')) return 'BODY'
    // Hide the base body mesh from selection
    if (lower === 'body') return null

    for (const rule of SECTION_RULES) {
      if (matchesKeyword(meshName, rule.keywords)) {
        return rule.category
      }
    }
    return 'ACCESSORIES'
  }, [])

  const getSubcategory = useCallback((meshName: string): string => {
    if (meshName === 'Eyes' || meshName === 'Eyes_3' || matchesKeyword(meshName, ['eyes'])) return 'Eyes'
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

  // Default body parts for new characters
  const DEFAULT_BODY_ASSETS = ['Eyes_3', 'Chill Brows', 'Closed Mouth']

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

  // Body item selection - only ONE of each type (eyes, eyebrows, mouths)
  const selectBodyItem = (meshName: string, subcategory: string) => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char

      // Get all items in this subcategory
      const subcategoryItems = availableMeshes.filter(mesh =>
        categorizeMesh(mesh) === 'BODY' && getSubcategory(mesh) === subcategory
      )

      // Remove all items from this subcategory, then add the selected one
      const newAssets = char.visibleAssets.filter(asset => !subcategoryItems.includes(asset))
      newAssets.push(meshName)

      return { ...char, visibleAssets: newAssets }
    }))
  }

  // Get current selected item for a body subcategory
  const getSelectedBodyItem = (subcategory: string): string | null => {
    if (!selectedCharacter) return null

    const subcategoryItems = availableMeshes.filter(mesh =>
      categorizeMesh(mesh) === 'BODY' && getSubcategory(mesh) === subcategory
    )

    return selectedCharacter.visibleAssets.find(asset => subcategoryItems.includes(asset)) || null
  }

  // Get items for a specific body subcategory
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

  // Height scale management
  const handleHeightScaleChange = (scale: number) => {
    if (!selectedCharacterId) return

    setCharacters(characters.map(char => {
      if (char.id !== selectedCharacterId) return char
      return { ...char, heightScale: scale }
    }))
  }

  // Morph target (shape key) management
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

  // Transform management
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

  // Get items for current category
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

  // Get subcategories for current category
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

  // Compute per-mesh color map for 3D viewer
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
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      {/* Left Sidebar - Character List */}
      <aside className="w-20 bg-card border-r border-border flex flex-col items-center py-4 gap-2">
        <Button
          onClick={handleCreateCharacter}
          disabled={characters.length >= 20}
          variant="outline"
          size="sm"
          className="w-14 h-14 flex flex-col items-center justify-center p-1"
          title="Create New Character"
        >
          <Plus size={20} />
          <span className="text-[9px] mt-0.5">NEW</span>
        </Button>

        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 py-2">
          {characters.map((character) => (
            <button
              key={character.id}
              onClick={() => setSelectedCharacterId(character.id)}
              className={`w-14 h-14 rounded-lg flex items-center justify-center transition-all ${
                selectedCharacterId === character.id
                  ? 'bg-sky-500/20 border-2 border-sky-500'
                  : 'bg-muted border-2 border-transparent hover:bg-muted/80'
              }`}
              title={character.name}
            >
              <User size={24} className={selectedCharacterId === character.id ? 'text-sky-500' : 'text-muted-foreground'} />
            </button>
          ))}
        </div>

        {selectedCharacter && (
          <Button
            onClick={() => handleDeleteCharacter(selectedCharacter.id)}
            variant="ghost"
            size="sm"
            className="w-14 text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={16} />
          </Button>
        )}
      </aside>

      {/* Center - 3D Viewport */}
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
          heightScale={selectedCharacter?.heightScale ?? 1.0}
        />

        {/* Empty State */}
        {!selectedCharacter && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
            <div className="text-center">
              <User size={64} className="mx-auto mb-4 text-gray-500" />
              <h2 className="text-xl font-semibold text-gray-300 mb-2">No Character Selected</h2>
              <p className="text-gray-500">Click + to create a character</p>
            </div>
          </div>
        )}

        {/* Character Name Input */}
        {selectedCharacter && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border">
            <input
              type="text"
              value={selectedCharacter.name}
              onChange={(e) => handleUpdateCharacterName(selectedCharacter.id, e.target.value)}
              className="bg-transparent text-foreground text-sm font-medium outline-none w-40"
              placeholder="Character Name"
            />
            <button className="text-muted-foreground hover:text-foreground">
              <Shuffle size={14} />
            </button>
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

      {/* Right Panel - Categories & Items */}
      <aside className="w-80 bg-card border-l border-border flex">
        {/* Category Tabs */}
        <div className="w-16 bg-muted/50 flex flex-col items-center py-4 gap-1">
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon
            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (!selectedCharacter) return
                  setCurrentCategory(cat.id)
                  setCurrentSubcategory(null)
                }}
                disabled={!selectedCharacter}
                className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                  currentCategory === cat.id
                    ? 'bg-sky-500/20 text-sky-500'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } ${!selectedCharacter ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={cat.label}
              >
                <IconComponent size={18} />
                <span className="text-[8px] font-medium">{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedCharacter ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shirt size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Select a character to customize</p>
            </div>
          ) : !currentCategory ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Select a category to start</p>
            </div>
          ) : currentCategory === 'BODY' ? (
            /* BODY Category - Gacha-style scroll selectors */
            <div className="space-y-6">
              {/* Skin Tone Color */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Skin Tone</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setColorPickerOpen('body-skin')}
                      className="w-8 h-8 rounded-lg border-2 border-border"
                      style={{ backgroundColor: selectedCharacter.colors.body.skinTone }}
                    />
                    <button
                      onClick={() => handleCategoryColorChange('body', 'skinTone', DEFAULT_COLORS.body.skinTone)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Reset color"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Height Slider */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Height</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {Math.round((selectedCharacter.heightScale ?? 1.0) * 100)}%
                    </span>
                    <button
                      onClick={() => handleHeightScaleChange(1.0)}
                      className="text-muted-foreground hover:text-foreground"
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
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Short</span>
                  <span>Tall</span>
                </div>
              </div>

              {/* Body Shape Keys */}
              {availableMorphTargets.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">Body Shape</span>
                    <button
                      onClick={handleResetAllMorphTargets}
                      className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1"
                      title="Reset all shape keys"
                    >
                      <RotateCcw size={12} />
                      Reset All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {availableMorphTargets.map((target) => {
                      const key = `${target.meshName}:${target.targetName}`
                      const value = selectedCharacter.morphTargets?.[key] ?? 0
                      // Clean up target name for display (remove mesh prefix if present)
                      const displayName = target.targetName
                        .replace(/^Key\s*/i, '')
                        .replace(/_/g, ' ')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')

                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground truncate flex-1 mr-2">
                              {displayName}
                            </span>
                            <span className="text-[10px] text-muted-foreground w-8 text-right">
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

              {/* Eyes Selector */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Eyes</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {getBodySubcategoryItems('Eyes').map((meshName) => {
                    const isSelected = getSelectedBodyItem('Eyes') === meshName
                    return (
                      <button
                        key={meshName}
                        onClick={() => selectBodyItem(meshName, 'Eyes')}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-all overflow-hidden ${
                          isSelected
                            ? 'border-sky-500 ring-2 ring-sky-500/50'
                            : 'border-border hover:border-sky-500/50'
                        }`}
                        title={meshName}
                      >
                        <ItemThumbnail meshName={meshName} color={selectedCharacter.colors.body.eyeColor} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Eyebrows Selector */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Eyebrows</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {getBodySubcategoryItems('Eyebrows').map((meshName) => {
                    const isSelected = getSelectedBodyItem('Eyebrows') === meshName
                    return (
                      <button
                        key={meshName}
                        onClick={() => selectBodyItem(meshName, 'Eyebrows')}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-all overflow-hidden ${
                          isSelected
                            ? 'border-sky-500 ring-2 ring-sky-500/50'
                            : 'border-border hover:border-sky-500/50'
                        }`}
                        title={meshName}
                      >
                        <ItemThumbnail meshName={meshName} color={selectedCharacter.colors.hair} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mouths Selector */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Mouth</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {getBodySubcategoryItems('Mouths').map((meshName) => {
                    const isSelected = getSelectedBodyItem('Mouths') === meshName
                    return (
                      <button
                        key={meshName}
                        onClick={() => selectBodyItem(meshName, 'Mouths')}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-all overflow-hidden ${
                          isSelected
                            ? 'border-sky-500 ring-2 ring-sky-500/50'
                            : 'border-border hover:border-sky-500/50'
                        }`}
                        title={meshName}
                      >
                        <ItemThumbnail meshName={meshName} color={selectedCharacter.colors.body.skinTone} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Other Categories - Grid layout with toggle */
            <>
              {/* Subcategory Filter */}
              {getSubcategories().length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setCurrentSubcategory(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      !currentSubcategory
                        ? 'bg-sky-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All
                  </button>
                  {getSubcategories().map((subcat) => (
                    <button
                      key={subcat}
                      onClick={() => setCurrentSubcategory(currentSubcategory === subcat ? null : subcat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        currentSubcategory === subcat
                          ? 'bg-sky-500 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {subcat}
                    </button>
                  ))}
                </div>
              )}

              {/* Color Picker */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Color:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setColorPickerOpen(currentCategory?.toLowerCase() || null)}
                      className="w-8 h-8 rounded-lg border-2 border-border"
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
                      className="text-muted-foreground hover:text-foreground"
                      title="Reset color"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-3 gap-2">
                {getCategoryItems().map((meshName) => {
                  const isSelected = selectedCharacter.visibleAssets.includes(meshName)
                  return (
                    <button
                      key={meshName}
                      onClick={() => toggleAsset(meshName)}
                      className={`aspect-square rounded-lg border-2 transition-all flex items-center justify-center text-xs font-medium ${
                        isSelected
                          ? 'border-sky-500 bg-sky-500/20'
                          : 'border-border bg-muted hover:bg-muted/80'
                      }`}
                      title={meshName}
                    >
                      <span className="text-[10px] text-center px-1 truncate">{meshName}</span>
                    </button>
                  )
                })}
              </div>

              {getCategoryItems().length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No items in this category</p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Color Picker Modal */}
      {colorPickerOpen && selectedCharacter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="max-w-sm w-full mx-4">
            <ColorWheel
              currentColor={getCategoryColor(currentCategory, currentSubcategory)}
              onChange={(color) => {
                const cat = currentCategory?.toLowerCase()
                if (cat) {
                  handleCategoryColorChange(cat, 'primary', color)
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
