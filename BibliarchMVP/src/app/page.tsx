"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Book, Trash2, Upload, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

export default function Dashboard() {
  const router = useRouter()
  const { stories, createStory, deleteStory } = useStoryStore()
  const [newStoryTitle, setNewStoryTitle] = useState("")
  const [newStoryDescription, setNewStoryDescription] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null)

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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="liquid-header sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Book className="w-7 h-7 text-sky-500" />
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                Bibliarch
              </h1>
            </div>
            <Button variant="liquid-secondary" size="liquid-default" disabled className="opacity-50">
              <Upload className="w-4 h-4" />
              Import
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
            Your Stories
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Create and manage your story projects
          </p>
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Create New Story Card */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Card
                variant="liquid"
                className="border-dashed border-2 border-slate-300 dark:border-slate-600 bg-transparent hover:bg-white/50 dark:hover:bg-slate-800/50 h-40 flex items-center justify-center"
              >
                <CardContent className="flex flex-col items-center justify-center gap-3 p-6">
                  <Plus className="w-8 h-8 text-slate-400" />
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    New Story
                  </span>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Story</DialogTitle>
                <DialogDescription>
                  Give your story a title and optional description.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    placeholder="My Amazing Story"
                    className="liquid-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    value={newStoryDescription}
                    onChange={(e) => setNewStoryDescription(e.target.value)}
                    placeholder="A brief description of your story..."
                    rows={3}
                    className="liquid-input resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="liquid-ghost" size="liquid-default" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="liquid" size="liquid-default" onClick={handleCreateStory} disabled={!newStoryTitle.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Existing Stories */}
          {stories.map((story) => (
            <Card
              key={story.id}
              variant="liquid"
              onClick={() => handleOpenStory(story.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-sky-500" />
                    <CardTitle className="text-base">{story.title}</CardTitle>
                  </div>
                  <Button
                    variant="liquid-ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      setStoryToDelete(story.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {story.description && (
                  <CardDescription className="line-clamp-2 mt-1.5 text-xs">
                    {story.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Updated {formatDate(story.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {stories.length === 0 && (
          <div className="text-center py-16">
            <Book className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-1">
              No stories yet
            </h3>
            <p className="text-slate-500 dark:text-slate-500 text-sm mb-6">
              Create your first story to get started
            </p>
            <Button
              variant="liquid"
              size="liquid-default"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Create Story
            </Button>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!storyToDelete} onOpenChange={() => setStoryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Story</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this story? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="liquid-ghost" size="liquid-default" onClick={() => setStoryToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="liquid-destructive"
              size="liquid-default"
              onClick={() => storyToDelete && handleDeleteStory(storyToDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
