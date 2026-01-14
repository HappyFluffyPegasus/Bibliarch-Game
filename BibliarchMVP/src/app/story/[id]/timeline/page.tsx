"use client"

import { useState, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  FileText,
  Users,
  MapPin,
  Sparkles,
  Copy,
  BookOpen,
  MessageSquare,
  Target,
  Lightbulb,
  Tag,
  Calendar,
  Link2,
  LayoutList,
  GitBranch,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useStoryStore } from "@/stores/storyStore"
import { TimelineEvent, EventCharacter, TimelineTrack } from "@/types/timeline"
import { TimelineCanvas } from "@/components/timeline"

// Section collapse state
interface SectionState {
  summary: boolean
  script: boolean
  relevance: boolean
  characters: boolean
  notes: boolean
  scene: boolean
}

const EVENT_COLORS = [
  { name: "Blue", value: "#3B82F6", bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500" },
  { name: "Green", value: "#10B981", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" },
  { name: "Amber", value: "#F59E0B", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500" },
  { name: "Red", value: "#EF4444", bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-500" },
  { name: "Purple", value: "#8B5CF6", bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-500" },
  { name: "Pink", value: "#EC4899", bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-500" },
]

// Pastel track colors
const TRACK_COLORS = [
  "#A7C7E7", // Pastel blue
  "#B5EAD7", // Pastel mint
  "#FFDAC1", // Pastel peach
  "#E2B6CF", // Pastel rose
  "#C7CEEA", // Pastel lavender
  "#F6E6B4", // Pastel yellow
  "#B8E0D2", // Pastel teal
  "#EAC4D5", // Pastel pink
]

const PRESET_TAGS = ["Opening", "Rising Action", "Climax", "Falling Action", "Resolution", "Flashback", "Dream", "Conflict", "Romance", "Comedy", "Drama", "Action"]

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  iconColor,
  isOpen,
  onToggle,
  description,
  children
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  isOpen: boolean
  onToggle: () => void
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <h2 className="font-semibold text-foreground text-sm">{title}</h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">— {description}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="p-3 border-t border-border">{children}</div>}
    </section>
  )
}

export default function TimelinePage() {
  const params = useParams()
  const storyId = params.id as string
  const {
    stories,
    timelineEvents,
    timelineTracks,
    addTimelineEvent,
    updateTimelineEvent,
    deleteTimelineEvent,
    addTimelineTrack,
    updateTimelineTrack,
    deleteTimelineTrack
  } = useStoryStore()
  const story = stories.find((s) => s.id === storyId)

  // Get events and tracks for this story from the store
  const events = timelineEvents[storyId] || []
  const storedTracks = timelineTracks[storyId] || []

  // Ensure at least one default track exists
  const tracks = useMemo(() => {
    if (storedTracks.length === 0) {
      return [{ id: 'main', name: 'Main Story', color: TRACK_COLORS[0] }]
    }
    return storedTracks.map(t => ({ id: t.id, name: t.name, color: t.color }))
  }, [storedTracks])

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [parentEventId, setParentEventId] = useState<string | null>(null)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  // Section collapse states
  const [sections, setSections] = useState<SectionState>({
    summary: true,
    script: true,
    relevance: false,
    characters: false,
    notes: false,
    scene: false
  })

  // Filter events based on current parent
  const visibleEvents = useMemo(() => {
    return events.filter(e => (e.parentId || null) === parentEventId)
  }, [events, parentEventId])

  const selectedEvent = events.find((e) => e.id === selectedEventId)
  const selectedColor = EVENT_COLORS.find((c) => c.value === selectedEvent?.color) || EVENT_COLORS[0]
  const parentEvent = parentEventId ? events.find(e => e.id === parentEventId) : null

  // Breadcrumb navigation
  const breadcrumbs = useMemo(() => {
    const crumbs: { id: string; title: string }[] = []
    let currentId = parentEventId
    while (currentId) {
      const event = events.find(e => e.id === currentId)
      if (event) {
        crumbs.unshift({ id: event.id, title: event.title })
        currentId = event.parentId || null
      } else {
        break
      }
    }
    return crumbs
  }, [events, parentEventId])

  // Toggle section
  const toggleSection = (section: keyof SectionState) => {
    setSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleCreateEvent = useCallback((trackIndex: number = 0) => {
    const trackEvents = visibleEvents.filter(e => (e.track ?? 0) === trackIndex)

    // Find the first available order position (fill gaps first, then append)
    const usedOrders = new Set(trackEvents.map(e => e.order))
    let newOrder = 0
    while (usedOrders.has(newOrder)) {
      newOrder++
    }

    // Get the track's color
    const track = tracks[trackIndex]
    const trackColor = track?.color || TRACK_COLORS[trackIndex % TRACK_COLORS.length]

    const newEvent: TimelineEvent = {
      id: generateId(),
      storyId,
      order: newOrder,
      title: `Event ${visibleEvents.length + 1}`,
      summary: "",
      script: "",
      relevance: "",
      notes: "",
      location: "",
      timeframe: "",
      characters: [],
      tags: [],
      color: trackColor,
      track: trackIndex,
      parentId: parentEventId || undefined
    }
    addTimelineEvent(storyId, newEvent)

    // Mark parent as having children when creating a sub-event
    if (parentEventId) {
      updateTimelineEvent(storyId, parentEventId, { hasChildren: true })
    }
  }, [storyId, visibleEvents, tracks, parentEventId, addTimelineEvent, updateTimelineEvent])

  const handleUpdateEvent = useCallback((eventId: string, updates: Partial<TimelineEvent>) => {
    updateTimelineEvent(storyId, eventId, updates)
  }, [storyId, updateTimelineEvent])

  const handleDeleteEvent = useCallback((eventId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Event',
      message: 'Are you sure you want to delete this event? This action cannot be undone.',
      onConfirm: () => {
        deleteTimelineEvent(storyId, eventId)
        if (selectedEventId === eventId) {
          setSelectedEventId(null)
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [storyId, selectedEventId, deleteTimelineEvent])

  // Track management
  const handleAddTrack = useCallback(() => {
    // If the default main track isn't stored yet, store it first
    if (storedTracks.length === 0) {
      const mainTrack: TimelineTrack = {
        id: 'main',
        storyId,
        name: 'Main Story',
        order: 0,
        color: TRACK_COLORS[0]
      }
      addTimelineTrack(storyId, mainTrack)
    }

    const newTrackIndex = storedTracks.length === 0 ? 1 : tracks.length
    const newTrack: TimelineTrack = {
      id: generateId(),
      storyId,
      name: `Track ${newTrackIndex + 1}`,
      order: newTrackIndex,
      color: TRACK_COLORS[newTrackIndex % TRACK_COLORS.length]
    }
    addTimelineTrack(storyId, newTrack)

    // Automatically create an event in the new track
    const newEvent: TimelineEvent = {
      id: generateId(),
      storyId,
      order: 0,
      title: `Event 1`,
      summary: "",
      script: "",
      relevance: "",
      notes: "",
      location: "",
      timeframe: "",
      characters: [],
      tags: [],
      color: newTrack.color,
      track: newTrackIndex,
      parentId: parentEventId || undefined
    }
    addTimelineEvent(storyId, newEvent)
  }, [storyId, storedTracks.length, tracks.length, parentEventId, addTimelineTrack, addTimelineEvent])

  const handleRenameTrack = useCallback((trackId: string, name: string) => {
    if (trackId === 'main') {
      // Create the main track if it doesn't exist in store
      const existingMain = storedTracks.find(t => t.id === 'main')
      if (!existingMain) {
        const mainTrack: TimelineTrack = {
          id: 'main',
          storyId,
          name,
          order: 0,
          color: TRACK_COLORS[0]
        }
        addTimelineTrack(storyId, mainTrack)
      } else {
        updateTimelineTrack(storyId, trackId, { name })
      }
    } else {
      updateTimelineTrack(storyId, trackId, { name })
    }
  }, [storyId, storedTracks, addTimelineTrack, updateTimelineTrack])

  const handleDeleteTrack = useCallback((trackId: string) => {
    if (trackId === 'main') return // Don't delete main track
    const trackIndex = tracks.findIndex(t => t.id === trackId)
    if (trackIndex === -1) return

    const trackEvents = events.filter(e => e.track === trackIndex)
    const message = trackEvents.length > 0
      ? `This will delete the track and ${trackEvents.length} event(s) inside it. This action cannot be undone.`
      : "This action cannot be undone."

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Track',
      message,
      onConfirm: () => {
        // Delete all events on this track
        if (events && events.length > 0) {
          trackEvents.forEach(e => {
            deleteTimelineEvent(storyId, e.id)
          })

          // Shift events on higher tracks down by 1
          events.filter(e => e.track > trackIndex).forEach(e => {
            updateTimelineEvent(storyId, e.id, { track: e.track - 1 })
          })
        }

        // Delete the track itself
        deleteTimelineTrack(storyId, trackId)
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [storyId, tracks, events, deleteTimelineTrack, deleteTimelineEvent, updateTimelineEvent])

  // Hierarchical navigation
  const handleEnterEvent = useCallback((eventId: string) => {
    setParentEventId(eventId)
    setSelectedEventId(null)
    // Don't mark hasChildren here - only mark it when a child is actually created
  }, [])

  const handleNavigateUp = useCallback(() => {
    if (parentEvent?.parentId) {
      setParentEventId(parentEvent.parentId)
    } else {
      setParentEventId(null)
    }
    setSelectedEventId(null)
  }, [parentEvent])

  const handleNavigateToBreadcrumb = useCallback((id: string | null) => {
    setParentEventId(id)
    setSelectedEventId(null)
  }, [])

  // Character management for events
  const handleAddCharacter = (eventId: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    const newCharacter: EventCharacter = {
      id: generateId(),
      name: "",
      role: "",
      emotion: "",
      goal: ""
    }

    handleUpdateEvent(eventId, {
      characters: [...event.characters, newCharacter]
    })
  }

  const handleUpdateCharacter = (eventId: string, charId: string, updates: Partial<EventCharacter>) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    handleUpdateEvent(eventId, {
      characters: event.characters.map((c) =>
        c.id === charId ? { ...c, ...updates } : c
      )
    })
  }

  const handleRemoveCharacter = (eventId: string, charId: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    handleUpdateEvent(eventId, {
      characters: event.characters.filter((c) => c.id !== charId)
    })
  }

  // Tag management
  const handleAddTag = (eventId: string, tag: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event || event.tags.includes(tag)) return

    handleUpdateEvent(eventId, { tags: [...event.tags, tag] })
  }

  const handleRemoveTag = (eventId: string, tag: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    handleUpdateEvent(eventId, { tags: event.tags.filter((t) => t !== tag) })
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-semibold text-foreground">{story?.title || "Story"} - Timeline</h1>
            <p className="text-xs text-muted-foreground">
              {visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''} • {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              {parentEvent && <span className="ml-2">• Viewing sub-events of "{parentEvent.title}"</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Click track's "Add Event" button to create events</span>
        </div>
      </header>

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Visual Timeline Canvas */}
        <div className={`${selectedEvent ? 'w-1/2' : 'w-full'} transition-all duration-200 border-r border-border`}>
          <TimelineCanvas
            events={visibleEvents}
            tracks={tracks}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onUpdateEvent={handleUpdateEvent}
            onCreateEvent={handleCreateEvent}
            onAddTrack={handleAddTrack}
            onRenameTrack={handleRenameTrack}
            onDeleteTrack={handleDeleteTrack}
            parentEvent={parentEvent}
            onNavigateUp={handleNavigateUp}
            breadcrumbs={breadcrumbs}
            onNavigateToBreadcrumb={handleNavigateToBreadcrumb}
          />
        </div>

        {/* Event Editor Panel */}
        {selectedEvent && (
          <div className="w-1/2 flex flex-col overflow-hidden">
            {/* Event Header */}
            <header className={`flex-shrink-0 border-b border-border p-4 ${selectedColor.bg}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={selectedEvent.title}
                    onChange={(e) => handleUpdateEvent(selectedEvent.id, { title: e.target.value })}
                    placeholder="Event Title"
                    className="text-xl font-bold bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground/50"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    {/* Color Picker */}
                    <div className="flex items-center gap-1">
                      {EVENT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => handleUpdateEvent(selectedEvent.id, { color: color.value })}
                          className={`w-5 h-5 rounded-full transition-all ${
                            selectedEvent.color === color.value
                              ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <input
                        type="text"
                        value={selectedEvent.location}
                        onChange={(e) => handleUpdateEvent(selectedEvent.id, { location: e.target.value })}
                        placeholder="Location"
                        className="bg-transparent border-none outline-none w-24 placeholder:text-muted-foreground/50 text-foreground"
                      />
                    </div>

                    {/* Timeframe */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <input
                        type="text"
                        value={selectedEvent.timeframe}
                        onChange={(e) => handleUpdateEvent(selectedEvent.id, { timeframe: e.target.value })}
                        placeholder="When"
                        className="bg-transparent border-none outline-none w-24 placeholder:text-muted-foreground/50 text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEnterEvent(selectedEvent.id)}
                    className="text-xs"
                    title="Double-click an event to enter sub-events"
                  >
                    <LayoutList className="w-3 h-3 mr-1" />
                    Sub-Events
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedEventId(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                {selectedEvent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded-full bg-background/50 text-foreground flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(selectedEvent.id, tag)}
                      className="hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setShowTagPicker(!showTagPicker)}
                    className="text-xs px-2 py-1 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Tag className="w-3 h-3 inline mr-1" />
                    Add tag
                  </button>
                  {showTagPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg p-2 z-50 min-w-48">
                      <div className="grid grid-cols-2 gap-1">
                        {PRESET_TAGS.filter((t) => !selectedEvent.tags.includes(t)).map((tag) => (
                          <button
                            key={tag}
                            onClick={() => {
                              handleAddTag(selectedEvent.id, tag)
                              setShowTagPicker(false)
                            }}
                            className="text-xs px-2 py-1 rounded hover:bg-muted text-left"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Summary */}
              <CollapsibleSection
                title="Summary"
                icon={FileText}
                iconColor="text-blue-500"
                isOpen={sections.summary}
                onToggle={() => toggleSection("summary")}
                description="Brief overview of the event (max 400 chars)"
              >
                <div className="relative">
                  <textarea
                    value={selectedEvent.summary}
                    onChange={(e) => handleUpdateEvent(selectedEvent.id, { summary: e.target.value.slice(0, 400) })}
                    placeholder="Write a concise summary of what happens in this event..."
                    className="w-full min-h-24 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/50 text-foreground"
                    maxLength={400}
                  />
                  <div className={`text-xs text-right mt-1 ${
                    (selectedEvent.summary?.length || 0) > 350
                      ? (selectedEvent.summary?.length || 0) >= 400
                        ? 'text-destructive'
                        : 'text-amber-500'
                      : 'text-muted-foreground'
                  }`}>
                    {selectedEvent.summary?.length || 0}/400
                  </div>
                </div>
              </CollapsibleSection>

              {/* Script */}
              <CollapsibleSection
                title="Script"
                icon={MessageSquare}
                iconColor="text-green-500"
                isOpen={sections.script}
                onToggle={() => toggleSection("script")}
                description="Dialogue and action beats"
              >
                <textarea
                  value={selectedEvent.script}
                  onChange={(e) => handleUpdateEvent(selectedEvent.id, { script: e.target.value })}
                  placeholder="Write dialogue and stage directions..."
                  className="w-full min-h-32 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/50 font-mono text-foreground"
                />
              </CollapsibleSection>

              {/* Relevance */}
              <CollapsibleSection
                title="Story Relevance"
                icon={Target}
                iconColor="text-amber-500"
                isOpen={sections.relevance}
                onToggle={() => toggleSection("relevance")}
                description="Why this event matters"
              >
                <textarea
                  value={selectedEvent.relevance}
                  onChange={(e) => handleUpdateEvent(selectedEvent.id, { relevance: e.target.value })}
                  placeholder="Explain the significance of this event to the overall story..."
                  className="w-full min-h-20 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/50 text-foreground"
                />
              </CollapsibleSection>

              {/* Characters */}
              <CollapsibleSection
                title="Characters"
                icon={Users}
                iconColor="text-violet-500"
                isOpen={sections.characters}
                onToggle={() => toggleSection("characters")}
                description="Who is involved"
              >
                <div className="space-y-3">
                  {selectedEvent.characters.map((char) => (
                    <div key={char.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={char.name}
                          onChange={(e) =>
                            handleUpdateCharacter(selectedEvent.id, char.id, { name: e.target.value })
                          }
                          placeholder="Character name"
                          className="bg-transparent font-medium text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
                        />
                        <button
                          onClick={() => handleRemoveCharacter(selectedEvent.id, char.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={char.role}
                          onChange={(e) =>
                            handleUpdateCharacter(selectedEvent.id, char.id, { role: e.target.value })
                          }
                          placeholder="Role"
                          className="bg-muted text-xs p-1.5 rounded outline-none placeholder:text-muted-foreground/50 text-foreground"
                        />
                        <input
                          type="text"
                          value={char.emotion}
                          onChange={(e) =>
                            handleUpdateCharacter(selectedEvent.id, char.id, { emotion: e.target.value })
                          }
                          placeholder="Emotion"
                          className="bg-muted text-xs p-1.5 rounded outline-none placeholder:text-muted-foreground/50 text-foreground"
                        />
                        <input
                          type="text"
                          value={char.goal}
                          onChange={(e) =>
                            handleUpdateCharacter(selectedEvent.id, char.id, { goal: e.target.value })
                          }
                          placeholder="Goal"
                          className="bg-muted text-xs p-1.5 rounded outline-none placeholder:text-muted-foreground/50 text-foreground"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddCharacter(selectedEvent.id)}
                    className="w-full"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Character
                  </Button>
                </div>
              </CollapsibleSection>

              {/* Notes */}
              <CollapsibleSection
                title="Author Notes"
                icon={Lightbulb}
                iconColor="text-yellow-500"
                isOpen={sections.notes}
                onToggle={() => toggleSection("notes")}
                description="Ideas and reminders"
              >
                <textarea
                  value={selectedEvent.notes}
                  onChange={(e) => handleUpdateEvent(selectedEvent.id, { notes: e.target.value })}
                  placeholder="Jot down ideas, research notes, or reminders..."
                  className="w-full min-h-20 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/50 text-foreground"
                />
              </CollapsibleSection>

              {/* Scene Link */}
              <CollapsibleSection
                title="Linked Scene"
                icon={Link2}
                iconColor="text-cyan-500"
                isOpen={sections.scene}
                onToggle={() => toggleSection("scene")}
                description="Connect to a scene"
              >
                <div className="text-sm text-muted-foreground">
                  {selectedEvent.linkedSceneId ? (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span>Scene linked</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateEvent(selectedEvent.id, { linkedSceneId: undefined })}
                      >
                        Unlink
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>No scene linked to this event yet.</p>
                      <Button variant="outline" size="sm" disabled>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Generate Scene (Coming Soon)
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
