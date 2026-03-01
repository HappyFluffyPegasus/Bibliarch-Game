"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Book,
  Trash2,
  Upload,
  Sparkles,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useStoryStore } from "@/stores/storyStore"
import { cn } from "@/lib/utils"

export default function Dashboard() {
  const router = useRouter()
  const stories = useStoryStore((s) => s.stories)
  const createStory = useStoryStore((s) => s.createStory)
  const deleteStory = useStoryStore((s) => s.deleteStory)
  const updateStoryCoverImage = useStoryStore((s) => s.updateStoryCoverImage)

  const [newStoryTitle, setNewStoryTitle] = useState("")
  const [newStoryDescription, setNewStoryDescription] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null)

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Sort stories: most recently updated first
  const sortedStories = useMemo(
    () => [...stories].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [stories]
  )

  const handleCreateStory = () => {
    if (!newStoryTitle.trim()) return
    const story = createStory(newStoryTitle.trim(), newStoryDescription.trim())
    setNewStoryTitle("")
    setNewStoryDescription("")
    setIsCreateDialogOpen(false)
    router.push(`/story/${story.id}/notes`)
  }

  const handleDeleteStory = (id: string) => {
    deleteStory(id)
    setStoryToDelete(null)
  }

  const handleOpenStory = (id: string) => {
    router.push(`/story/${id}/notes`)
  }

  const handleCoverUpload = (storyId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (dataUrl) {
        updateStoryCoverImage(storyId, dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-[#0c1222]">
      {/* Background texture */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      {/* Header */}
      <header className="relative border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <Book className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Bibliarch
                </h1>
                <p className="text-sm text-slate-500">
                  {stories.length} {stories.length === 1 ? 'project' : 'projects'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="bg-white/[0.03] border-white/[0.08] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 rounded-xl"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-6xl mx-auto px-6 py-8">
        {/* Portrait Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* New Story Card */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <button className={cn(
                "aspect-[2/3] rounded-2xl border-2 border-dashed border-white/[0.08]",
                "hover:border-sky-500/40 cursor-pointer transition-all duration-200",
                "bg-white/[0.02] hover:bg-sky-500/[0.04]",
                "flex flex-col items-center justify-center gap-3",
                "group"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-xl",
                  "bg-sky-500/10 group-hover:bg-sky-500/20",
                  "flex items-center justify-center",
                  "transition-all duration-200",
                )}>
                  <Plus className="w-6 h-6 text-sky-400/70 group-hover:text-sky-400 transition-colors" />
                </div>
                <span className="font-medium text-slate-500 group-hover:text-slate-300 transition-colors text-sm">
                  New Story
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#141c2e] border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50">
              <DialogHeader>
                <DialogTitle className="text-slate-200">Create New Story</DialogTitle>
                <DialogDescription className="text-slate-500">
                  Give your story a title and optional description.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateStory() }}
                    placeholder="My Amazing Story"
                    autoFocus
                    className="w-full px-4 py-3 border border-white/[0.08] rounded-xl bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Description
                    <span className="text-slate-600 font-normal ml-1">optional</span>
                  </label>
                  <textarea
                    value={newStoryDescription}
                    onChange={(e) => setNewStoryDescription(e.target.value)}
                    placeholder="A brief description of your story..."
                    rows={3}
                    className="w-full px-4 py-3 border border-white/[0.08] rounded-xl bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="border-white/[0.08] text-slate-400 hover:bg-white/[0.05] rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateStory}
                  disabled={!newStoryTitle.trim()}
                  className="bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:opacity-90 shadow-lg shadow-sky-500/20 rounded-xl"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Story Cards */}
          {sortedStories.map((story) => (
            <div
              key={story.id}
              className={cn(
                "group relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer",
                "border border-white/[0.06] hover:border-white/[0.15]",
                "transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30",
              )}
              onClick={() => handleOpenStory(story.id)}
            >
              {/* Background: cover image or gradient placeholder */}
              {story.coverImage ? (
                <img
                  src={story.coverImage}
                  alt={story.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-slate-700/60 to-slate-900 flex items-center justify-center">
                  <Book className="w-12 h-12 text-slate-600/50" />
                </div>
              )}

              {/* Bottom overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 pt-12">
                <h3 className="font-semibold text-white text-sm truncate">
                  {story.title}
                </h3>
                {story.description && (
                  <p className="text-xs text-slate-300/70 mt-1 line-clamp-2">
                    {story.description.length > 80 ? story.description.slice(0, 80) + '...' : story.description}
                  </p>
                )}
              </div>

              {/* Delete button — top right on hover */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 text-white/60 hover:text-red-400 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  setStoryToDelete(story.id)
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>

              {/* Upload cover image button — top left on hover */}
              <button
                className="absolute top-2 left-2 h-7 w-7 flex items-center justify-center text-white/60 hover:text-sky-400 hover:bg-sky-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRefs.current[story.id]?.click()
                }}
                title="Upload cover image"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={(el) => { fileInputRefs.current[story.id] = el }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleCoverUpload(story.id, file)
                  e.target.value = ''
                }}
              />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {stories.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <Book className="w-9 h-9 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              No stories yet
            </h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Create your first story to start building characters, worlds, and scenes.
            </p>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!storyToDelete} onOpenChange={() => setStoryToDelete(null)}>
        <DialogContent className="bg-[#141c2e] border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50">
          <DialogHeader>
            <DialogTitle className="text-slate-200">Delete Story</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure? This will permanently delete the story and all its data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStoryToDelete(null)}
              className="border-white/[0.08] text-slate-400 hover:bg-white/[0.05] rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => storyToDelete && handleDeleteStory(storyToDelete)}
              className="bg-red-500/90 hover:bg-red-500 rounded-xl"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
