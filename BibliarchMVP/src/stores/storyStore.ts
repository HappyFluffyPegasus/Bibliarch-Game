import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Story, CanvasData, MasterDoc } from '@/types/story'
import { Character } from '@/types/character'
import { TimelineEvent, TimelineTrack } from '@/types/timeline'
import { Scene } from '@/types/scene'
import { World, SerializedWorld, serializeWorld, deserializeWorld } from '@/types/world'

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
  masterDocs: Record<string, MasterDoc[]>

  // Actions - Stories
  createStory: (title: string, description?: string) => Story
  updateStory: (id: string, updates: Partial<Story>) => void
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

  // Actions - World
  saveWorld: (storyId: string, world: World) => void

  // Actions - Master Docs
  addMasterDoc: (storyId: string, doc: MasterDoc) => void
  deleteMasterDoc: (storyId: string, docId: string) => void
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
      masterDocs: {},

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

      deleteStory: (id) => {
        set((state) => {
          const { [id]: _canvas, ...restCanvas } = state.canvasData
          const { [id]: _chars, ...restChars } = state.characters
          const { [id]: _timeline, ...restTimeline } = state.timelineEvents
          const { [id]: _tracks, ...restTracks } = state.timelineTracks
          const { [id]: _scenes, ...restScenes } = state.scenes
          const { [id]: _world, ...restWorlds } = state.worlds
          const { [id]: _docs, ...restDocs } = state.masterDocs

          return {
            stories: state.stories.filter((s) => s.id !== id),
            currentStoryId: state.currentStoryId === id ? null : state.currentStoryId,
            canvasData: restCanvas,
            characters: restChars,
            timelineEvents: restTimeline,
            timelineTracks: restTracks,
            scenes: restScenes,
            worlds: restWorlds,
            masterDocs: restDocs,
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

      // World actions
      saveWorld: (storyId, world) => {
        set((state) => ({
          worlds: {
            ...state.worlds,
            [storyId]: world,
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
