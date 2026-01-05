'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, LogOut, Sparkles, FileText, Clock, Settings, Trash2, Copy, Bitcoin } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { storyTemplates } from '@/lib/templates'
import { ensureDatabaseSetup } from '@/lib/database-init'
import FeedbackButton from '@/components/feedback/FeedbackButton'
import { useUser, useProfile, useStoriesPaginated, useCreateStory, useDeleteStory } from '@/lib/hooks/useSupabaseQuery'
import { InvitationsInbox } from '@/components/collaboration/InvitationsInbox'

type Story = {
  id: string
  title: string
  bio?: string
  created_at: string
  updated_at: string
  settings?: any
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  // Use cached queries
  const { data: user, isLoading: isUserLoading } = useUser()
  const { data: profile } = useProfile(user?.id)
  const {
    data: storiesData,
    isLoading: isStoriesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useStoriesPaginated(user?.id)
  const createStoryMutation = useCreateStory()
  const deleteStoryMutation = useDeleteStory()

  const username = profile?.username || 'Storyteller'
  const isLoading = isUserLoading || isStoriesLoading

  // Flatten all pages of stories into a single array
  const stories = storiesData?.pages.flatMap(page => page.stories) ?? []
  const totalCount = storiesData?.pages[0]?.totalCount ?? 0

  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank')
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectBio, setNewProjectBio] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ show: boolean; story: Story | null }>({ show: false, story: null })
  const [isDeleting, setIsDeleting] = useState(false)

  // Handle authentication
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login')
    }
  }, [user, isUserLoading, router])

  // Check database setup
  useEffect(() => {
    if (user?.id) {
      checkDatabaseSetup()
    }
  }, [user?.id])

  async function checkDatabaseSetup() {
    const dbSetup = await ensureDatabaseSetup()
    if (!dbSetup.success) {
      if (dbSetup.needsSetup) {
        alert(`Database Setup Required!\n\nThe database tables haven't been created yet. To fix this:\n\n1. Go to your Supabase project dashboard\n2. Open the SQL Editor\n3. Copy the entire contents of database-setup.sql\n4. Run it in the SQL Editor\n5. Refresh this page\n\nThis is a one-time setup step.`)
      } else {
        alert(`Database Connection Error: ${dbSetup.error}\n\nPlease check:\n• Your .env.local file has correct Supabase credentials\n• Your Supabase project is active\n• Your internet connection is working`)
      }
    }
  }

  function createNewStory() {
    setShowTemplateDialog(true)
  }

  function handleCreateWithTemplate() {
    // Close template dialog and open project settings dialog
    setShowTemplateDialog(false)
    setNewProjectName(`Untitled Story ${stories.length + 1}`)
    setNewProjectBio('')
    setShowProjectSettings(true)
  }

  async function handleSaveNewProject() {
    if (!newProjectName.trim()) {
      alert('Project name cannot be empty')
      return
    }

    if (!user?.id) {
      alert('Please log in to create a story.')
      return
    }

    const template = storyTemplates.find(t => t.id === selectedTemplate)

    createStoryMutation.mutate(
      {
        title: newProjectName.trim(),
        bio: newProjectBio.trim(),
        userId: user.id
      },
      {
        onSuccess: async (newStory) => {
          if (template) {
            // Save template nodes as initial canvas data
            if (template.nodes.length > 0) {
              const { error: insertError } = await supabase
                .from('canvas_data')
                .insert({
                  story_id: newStory.id,
                  canvas_type: 'main',
                  nodes: template.nodes,
                  connections: template.connections
                })

              if (insertError) {
                console.error('Error saving template:', insertError)
              }
            }

            // Save all sub-canvases
            if (template.subCanvases) {
              for (const [canvasId, canvasData] of Object.entries(template.subCanvases)) {
                await supabase
                  .from('canvas_data')
                  .insert({
                    story_id: newStory.id,
                    canvas_type: canvasId,
                    nodes: canvasData.nodes,
                    connections: canvasData.connections
                  })
              }
            }
          }

          setShowProjectSettings(false)
          router.push(`/story/${newStory.id}`)
        },
        onError: (error: any) => {
          console.error('Error creating story:', error)
          if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
            alert('Database setup incomplete. Please run the database setup script first.')
          } else {
            alert(`Failed to create story: ${error.message}`)
          }
        }
      }
    )
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  async function handleDuplicateStory(story: Story) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.error('User must be logged in to duplicate stories')
        return
      }

      // Create new story with "(Copy)" suffix
      const { data: newStory, error: storyError } = await supabase
        .from('stories')
        .insert({
          title: `${story.title} (Copy)`,
          user_id: user.id,
          settings: story.settings
        } as any)
        .select()
        .single()

      if (storyError || !newStory) {
        console.error('Error duplicating story:', storyError)
        return
      }

      // Get all canvas data for the original story
      const { data: canvasData, error: canvasError } = await supabase
        .from('canvas_data')
        .select('*')
        .eq('story_id', story.id)

      if (canvasError) {
        console.error('Error fetching canvas data:', canvasError)
        return
      }

      // Copy all canvas data to the new story
      if (canvasData && canvasData.length > 0) {
        const newCanvasData = canvasData.map((canvas: any) => ({
          story_id: (newStory as any).id,
          canvas_type: canvas.canvas_type,
          nodes: canvas.nodes,
          connections: canvas.connections
        }))

        const { error: insertError } = await supabase
          .from('canvas_data')
          .insert(newCanvasData)

        if (insertError) {
          console.error('Error inserting canvas data:', insertError)
          return
        }
      }

      // Navigate to the new story (React Query will refetch on next visit)
      router.push(`/story/${(newStory as any).id}`)
    } catch (error) {
      console.error('Unexpected error duplicating story:', error)
    }
  }

  async function handleDeleteStory() {
    if (!deleteDialog.story || !user?.id) return

    setIsDeleting(true)

    deleteStoryMutation.mutate(
      {
        storyId: deleteDialog.story.id,
        userId: user.id
      },
      {
        onSuccess: () => {
          setDeleteDialog({ show: false, story: null })
          setIsDeleting(false)
        },
        onError: (error) => {
          console.error('Error deleting story:', error)
          setIsDeleting(false)
        }
      }
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-2 md:px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sky-600 dark:text-blue-400" />
            <h1 className="hidden md:block text-xl font-bold bg-gradient-to-r from-sky-500 to-blue-600 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
              Bibliarch
            </h1>
          </div>

          <div className="flex items-center gap-1 md:gap-4">
            <span className="hidden md:block text-sm text-muted-foreground">
              Welcome back, <span className="font-medium">{username}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 md:h-9 md:w-9 p-0"
              title="Support Bibliarch"
            >
              <a
                href="https://pay.zaprite.com/pl_mTYYPoOo2S"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Bitcoin className="w-5 h-5" style={{ transform: 'rotate(0deg)' }} />
              </a>
            </Button>
            <div className="md:block"><FeedbackButton /></div>
            <div className="md:block"><ThemeToggle /></div>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="h-8 w-8 md:h-9 md:w-9 p-0">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit" className="h-8 w-8 md:h-9 md:w-9 p-0">
                <LogOut className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Invitations Inbox */}
        <InvitationsInbox />

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Your Stories</h2>
          <p className="text-muted-foreground">
            Create and manage your interactive story worlds
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-sky-600 dark:text-blue-400 animate-pulse mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your stories...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Create New Story Card */}
              <Card
                className="border-dashed border-2 hover:border-sky-400 dark:hover:border-blue-500 cursor-pointer transition-all duration-200 hover:scale-[1.02] group bg-white dark:bg-card"
                onClick={createNewStory}
              >
                <CardHeader className="text-center">
                  <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8 text-sky-600 dark:text-blue-400" />
                  </div>
                  <CardTitle>Create New Story</CardTitle>
                  <CardDescription>
                    Start a new adventure with infinite possibilities
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Story Cards */}
              {stories.map((story) => (
                <div key={story.id} className="relative">
                  <Link
                    href={`/story/${story.id}`}
                    className="block"
                  >
                    <Card className="h-full hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer bg-white dark:bg-card">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <FileText className="w-5 h-5 text-sky-600 dark:text-blue-400" />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(story.updated_at)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDuplicateStory(story)
                              }}
                              className="p-1.5 rounded hover:bg-sky-100 dark:hover:bg-blue-900/20 transition-colors group"
                              title="Duplicate story"
                            >
                              <Copy className="w-4 h-4 text-gray-400 group-hover:text-sky-600 dark:group-hover:text-blue-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setDeleteDialog({ show: true, story })
                              }}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors group"
                              title="Delete story"
                            >
                              <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                        <CardTitle className="line-clamp-1">{story.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {story.bio || 'Click to open and edit your story'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs text-muted-foreground">
                          Created {formatDate(story.created_at)}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasNextPage && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="outline"
                  size="lg"
                  className="min-w-[200px]"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More Stories
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({stories.length} of {totalCount})
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

      </main>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Choose a Story Template</DialogTitle>
            <DialogDescription>
              Start with a pre-built structure or begin with a blank canvas
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
            {storyTemplates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedTemplate === template.id
                    ? 'ring-2 ring-sky-600 dark:ring-blue-500'
                    : 'hover:border-sky-400 dark:hover:border-blue-500'
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardHeader className="space-y-4 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {selectedTemplate === template.id && (
                      <div className="w-6 h-6 rounded-full bg-sky-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {template.features.slice(0, 3).map((feature, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs rounded-full bg-sky-100 dark:bg-blue-900/30 text-sky-700 dark:text-blue-300"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTemplateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWithTemplate}
              className="bg-gradient-to-r from-sky-500 to-blue-600 dark:from-blue-500 dark:to-blue-700"
            >
              Create Story
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.show} onOpenChange={(open) => setDeleteDialog({ show: open, story: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Story?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.story?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 my-4">
            <div className="flex items-start gap-3">
              <div className="text-red-600 dark:text-red-400 mt-0.5">⚠️</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                  This will permanently delete:
                </p>
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                  <li>• The story and all its content</li>
                  <li>• All canvases (main and nested folders)</li>
                  <li>• All nodes, connections, and data</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ show: false, story: null })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStory}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Story'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Settings Dialog */}
      <Dialog open={showProjectSettings} onOpenChange={setShowProjectSettings}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Name Your Project</DialogTitle>
            <DialogDescription>
              Give your story a name and description
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="new-project-name" className="text-sm font-medium">
                Project Name
              </label>
              <Input
                id="new-project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="new-project-bio" className="text-sm font-medium">
                  Project Description
                </label>
                <span className="text-xs text-muted-foreground">
                  {newProjectBio.length}/150
                </span>
              </div>
              <Textarea
                id="new-project-bio"
                value={newProjectBio}
                onChange={(e) => {
                  if (e.target.value.length <= 150) {
                    setNewProjectBio(e.target.value)
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
                setShowProjectSettings(false)
                setNewProjectName('')
                setNewProjectBio('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewProject}
              className="bg-gradient-to-r from-sky-500 to-blue-600 dark:from-blue-500 dark:to-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}