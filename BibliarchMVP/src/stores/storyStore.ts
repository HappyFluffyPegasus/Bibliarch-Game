import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Story, CanvasData, MasterDoc } from '@/types/story'
import { Character } from '@/types/character'
import { TimelineEvent, TimelineTrack } from '@/types/timeline'
import { Scene } from '@/types/scenes'
import { World, SerializedWorld, serializeWorld, deserializeWorld } from '@/types/world'
import { CustomItem, SerializedCustomItem, serializeCustomItem, deserializeCustomItem } from '@/types/items'

interface StoryState {
  // All stories
  stories: Story[]

  // Current story context
  currentStoryId: string | null

  // Story data (indexed by storyId)
  canvasData: Record<string, CanvasData[]>
  characters: Record<string, Character[]>
  timelineEvents: Record<string, TimelineEvent[]>
  timelineTracks: Record<string, TimelineTrack[]>
  scenes: Record<string, Scene[]>
  worlds: Record<string, World>
  customItems: Record<string, CustomItem[]>
  masterDocs: Record<string, MasterDoc[]>
  characterNoteLinks: Record<string, { characterId: string; noteNodeId: string }[]>

  // Actions - Stories
  createStory: (title: string, description?: string) => Story
  updateStory: (id: string, updates: Partial<Story>) => void
  updateStoryCoverImage: (storyId: string, dataUrl: string) => void
  deleteStory: (id: string) => void
  setCurrentStory: (id: string | null) => void

  // Actions - Canvas
  saveCanvasData: (storyId: string, canvasType: string, nodes: CanvasData['nodes'], connections: CanvasData['connections']) => void
  getCanvasData: (storyId: string, canvasType: string) => CanvasData | undefined

  // Actions - Characters
  addCharacter: (storyId: string, character: Character) => void
  updateCharacter: (storyId: string, characterId: string, updates: Partial<Character>) => void
  deleteCharacter: (storyId: string, characterId: string) => void

  // Actions - Timeline Events
  addTimelineEvent: (storyId: string, event: TimelineEvent) => void
  updateTimelineEvent: (storyId: string, eventId: string, updates: Partial<TimelineEvent>) => void
  deleteTimelineEvent: (storyId: string, eventId: string) => void
  reorderTimelineEvents: (storyId: string, events: TimelineEvent[]) => void

  // Actions - Timeline Tracks
  addTimelineTrack: (storyId: string, track: TimelineTrack) => void
  updateTimelineTrack: (storyId: string, trackId: string, updates: Partial<TimelineTrack>) => void
  deleteTimelineTrack: (storyId: string, trackId: string) => void

  // Actions - Scenes
  addScene: (storyId: string, scene: Scene) => void
  updateScene: (storyId: string, sceneId: string, updates: Partial<Scene>) => void
  deleteScene: (storyId: string, sceneId: string) => void
  reorderScenes: (storyId: string, sceneIds: string[]) => void

  // Actions - World
  saveWorld: (storyId: string, world: World) => void

  // Actions - Custom Items
  addCustomItem: (storyId: string, item: CustomItem) => void
  updateCustomItem: (storyId: string, item: CustomItem) => void
  deleteCustomItem: (storyId: string, itemId: string) => void

  // Actions - Master Docs
  addMasterDoc: (storyId: string, doc: MasterDoc) => void
  deleteMasterDoc: (storyId: string, docId: string) => void

  // Actions - Character ↔ Note Links
  linkCharacterToNote: (storyId: string, characterId: string, noteNodeId: string) => void
  unlinkCharacterFromNote: (storyId: string, characterId: string) => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      stories: [],
      currentStoryId: null,
      canvasData: {},
      characters: {},
      timelineEvents: {},
      timelineTracks: {},
      scenes: {},
      worlds: {},
      customItems: {},
      masterDocs: {},
      characterNoteLinks: {},

      // Story actions
      createStory: (title, description = '') => {
        const newStory: Story = {
          id: generateId(),
          title,
          description,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({
          stories: [...state.stories, newStory],
        }))
        return newStory
      },

      updateStory: (id, updates) => {
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        }))
      },

      updateStoryCoverImage: (storyId, dataUrl) => {
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === storyId ? { ...s, coverImage: dataUrl, updatedAt: new Date() } : s
          ),
        }))
      },

      deleteStory: (id) => {
        set((state) => {
          const { [id]: _canvas, ...restCanvas } = state.canvasData
          const { [id]: _chars, ...restChars } = state.characters
          const { [id]: _timeline, ...restTimeline } = state.timelineEvents
          const { [id]: _tracks, ...restTracks } = state.timelineTracks
          const { [id]: _scenes, ...restScenes } = state.scenes
          const { [id]: _world, ...restWorlds } = state.worlds
          const { [id]: _items, ...restItems } = state.customItems
          const { [id]: _docs, ...restDocs } = state.masterDocs
          const { [id]: _links, ...restLinks } = state.characterNoteLinks

          return {
            stories: state.stories.filter((s) => s.id !== id),
            currentStoryId: state.currentStoryId === id ? null : state.currentStoryId,
            canvasData: restCanvas,
            characters: restChars,
            timelineEvents: restTimeline,
            timelineTracks: restTracks,
            scenes: restScenes,
            worlds: restWorlds,
            customItems: restItems,
            masterDocs: restDocs,
            characterNoteLinks: restLinks,
          }
        })
      },

      setCurrentStory: (id) => {
        set({ currentStoryId: id })
      },

      // Canvas actions
      saveCanvasData: (storyId, canvasType, nodes, connections) => {
        set((state) => {
          const storyCanvases = state.canvasData[storyId] || []
          const existingIndex = storyCanvases.findIndex((c) => c.canvasType === canvasType)

          const canvasEntry: CanvasData = {
            id: existingIndex >= 0 ? storyCanvases[existingIndex].id : generateId(),
            storyId,
            canvasType,
            nodes,
            connections,
          }

          const updatedCanvases =
            existingIndex >= 0
              ? storyCanvases.map((c, i) => (i === existingIndex ? canvasEntry : c))
              : [...storyCanvases, canvasEntry]

          return {
            canvasData: {
              ...state.canvasData,
              [storyId]: updatedCanvases,
            },
          }
        })
      },

      getCanvasData: (storyId, canvasType) => {
        const state = get()
        const storyCanvases = state.canvasData[storyId] || []
        return storyCanvases.find((c) => c.canvasType === canvasType)
      },

      // Character actions
      addCharacter: (storyId, character) => {
        set((state) => ({
          characters: {
            ...state.characters,
            [storyId]: [...(state.characters[storyId] || []), character],
          },
        }))
      },

      updateCharacter: (storyId, characterId, updates) => {
        set((state) => ({
          characters: {
            ...state.characters,
            [storyId]: (state.characters[storyId] || []).map((c) =>
              c.id === characterId ? { ...c, ...updates } : c
            ),
          },
        }))
      },

      deleteCharacter: (storyId, characterId) => {
        set((state) => ({
          characters: {
            ...state.characters,
            [storyId]: (state.characters[storyId] || []).filter((c) => c.id !== characterId),
          },
        }))
      },

      // Timeline actions
      addTimelineEvent: (storyId, event) => {
        set((state) => ({
          timelineEvents: {
            ...state.timelineEvents,
            [storyId]: [...(state.timelineEvents[storyId] || []), event],
          },
        }))
      },

      updateTimelineEvent: (storyId, eventId, updates) => {
        set((state) => ({
          timelineEvents: {
            ...state.timelineEvents,
            [storyId]: (state.timelineEvents[storyId] || []).map((e) =>
              e.id === eventId ? { ...e, ...updates } : e
            ),
          },
        }))
      },

      deleteTimelineEvent: (storyId, eventId) => {
        set((state) => ({
          timelineEvents: {
            ...state.timelineEvents,
            [storyId]: (state.timelineEvents[storyId] || []).filter((e) => e.id !== eventId),
          },
        }))
      },

      reorderTimelineEvents: (storyId, events) => {
        set((state) => ({
          timelineEvents: {
            ...state.timelineEvents,
            [storyId]: events,
          },
        }))
      },

      // Timeline Track actions
      addTimelineTrack: (storyId, track) => {
        set((state) => ({
          timelineTracks: {
            ...state.timelineTracks,
            [storyId]: [...(state.timelineTracks[storyId] || []), track],
          },
        }))
      },

      updateTimelineTrack: (storyId, trackId, updates) => {
        set((state) => ({
          timelineTracks: {
            ...state.timelineTracks,
            [storyId]: (state.timelineTracks[storyId] || []).map((t) =>
              t.id === trackId ? { ...t, ...updates } : t
            ),
          },
        }))
      },

      deleteTimelineTrack: (storyId, trackId) => {
        set((state) => ({
          timelineTracks: {
            ...state.timelineTracks,
            [storyId]: (state.timelineTracks[storyId] || []).filter((t) => t.id !== trackId),
          },
        }))
      },

      // Scene actions
      addScene: (storyId, scene) => {
        set((state) => ({
          scenes: {
            ...state.scenes,
            [storyId]: [...(state.scenes[storyId] || []), scene],
          },
        }))
      },

      updateScene: (storyId, sceneId, updates) => {
        set((state) => ({
          scenes: {
            ...state.scenes,
            [storyId]: (state.scenes[storyId] || []).map((s) =>
              s.id === sceneId ? { ...s, ...updates, updatedAt: new Date() } : s
            ),
          },
        }))
      },

      deleteScene: (storyId, sceneId) => {
        set((state) => ({
          scenes: {
            ...state.scenes,
            [storyId]: (state.scenes[storyId] || []).filter((s) => s.id !== sceneId),
          },
        }))
      },

      reorderScenes: (storyId, sceneIds) => {
        set((state) => {
          const existing = state.scenes[storyId] || []
          const byId = new Map(existing.map(s => [s.id, s]))
          const reordered = sceneIds.map(id => byId.get(id)).filter(Boolean) as Scene[]
          return {
            scenes: {
              ...state.scenes,
              [storyId]: reordered,
            },
          }
        })
      },

      // World actions
      saveWorld: (storyId, world) => {
        set((state) => ({
          worlds: {
            ...state.worlds,
            [storyId]: world,
          },
        }))
      },

      // Custom Item actions
      addCustomItem: (storyId, item) => {
        set((state) => ({
          customItems: {
            ...state.customItems,
            [storyId]: [...(state.customItems[storyId] || []), item],
          },
        }))
      },

      updateCustomItem: (storyId, item) => {
        set((state) => ({
          customItems: {
            ...state.customItems,
            [storyId]: (state.customItems[storyId] || []).map((i) =>
              i.id === item.id ? { ...item, updatedAt: new Date() } : i
            ),
          },
        }))
      },

      deleteCustomItem: (storyId, itemId) => {
        set((state) => ({
          customItems: {
            ...state.customItems,
            [storyId]: (state.customItems[storyId] || []).filter((i) => i.id !== itemId),
          },
        }))
      },

      // Master Doc actions
      addMasterDoc: (storyId, doc) => {
        set((state) => ({
          masterDocs: {
            ...state.masterDocs,
            [storyId]: [...(state.masterDocs[storyId] || []), doc],
          },
        }))
      },

      deleteMasterDoc: (storyId, docId) => {
        set((state) => ({
          masterDocs: {
            ...state.masterDocs,
            [storyId]: (state.masterDocs[storyId] || []).filter((d) => d.id !== docId),
          },
        }))
      },

      // Character ↔ Note Link actions
      linkCharacterToNote: (storyId, characterId, noteNodeId) => {
        set((state) => {
          const existing = state.characterNoteLinks[storyId] || []
          // Remove any existing link for this character first
          const filtered = existing.filter((l) => l.characterId !== characterId)
          return {
            characterNoteLinks: {
              ...state.characterNoteLinks,
              [storyId]: [...filtered, { characterId, noteNodeId }],
            },
          }
        })
      },

      unlinkCharacterFromNote: (storyId, characterId) => {
        set((state) => ({
          characterNoteLinks: {
            ...state.characterNoteLinks,
            [storyId]: (state.characterNoteLinks[storyId] || []).filter(
              (l) => l.characterId !== characterId
            ),
          },
        }))
      },
    }),
    {
      name: 'bibliarch-mvp-storage',
      // Custom serialization for dates and typed arrays
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const data = JSON.parse(str)
          // Convert date strings back to Date objects
          if (data.state?.stories) {
            data.state.stories = data.state.stories.map((s: Story) => ({
              ...s,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt),
            }))
          }
          // Deserialize custom items (date strings back to Dates)
          if (data.state?.customItems) {
            const deserialized: Record<string, CustomItem[]> = {}
            for (const [key, val] of Object.entries(data.state.customItems as Record<string, SerializedCustomItem[]>)) {
              try {
                deserialized[key] = (val || []).map(deserializeCustomItem)
              } catch {
                // Skip corrupted item data
              }
            }
            data.state.customItems = deserialized
          }
          // Deserialize worlds (convert plain arrays back to typed arrays)
          if (data.state?.worlds) {
            const deserializedWorlds: Record<string, World> = {}
            for (const [key, val] of Object.entries(data.state.worlds)) {
              try {
                deserializedWorlds[key] = deserializeWorld(val as SerializedWorld)
              } catch {
                // Skip corrupted world data
              }
            }
            data.state.worlds = deserializedWorlds
          }
          return data
        },
        setItem: (name, value) => {
          // Serialize worlds (convert typed arrays to plain arrays)
          const toSerialize = { ...value }
          if (toSerialize.state?.customItems) {
            const serializedItems: Record<string, SerializedCustomItem[]> = {}
            for (const [key, val] of Object.entries(toSerialize.state.customItems as Record<string, CustomItem[]>)) {
              serializedItems[key] = (val || []).map(serializeCustomItem)
            }
            toSerialize.state = { ...toSerialize.state, customItems: serializedItems as unknown as Record<string, CustomItem[]> }
          }
          if (toSerialize.state?.worlds) {
            const serializedWorlds: Record<string, SerializedWorld> = {}
            for (const [key, val] of Object.entries(toSerialize.state.worlds as Record<string, World>)) {
              serializedWorlds[key] = serializeWorld(val)
            }
            toSerialize.state = { ...toSerialize.state, worlds: serializedWorlds as unknown as Record<string, World> }
          }
          localStorage.setItem(name, JSON.stringify(toSerialize))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
    }
  )
)
