'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCollaborators,
  useRemoveCollaborator,
  useSearchUsers,
  useInviteUser,
} from '@/lib/hooks/useCollaboration'
import { Trash2, Users, Check, X, Edit3, Eye, Search, UserPlus, AtSign, Mail, Clock, AlertTriangle } from 'lucide-react'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storyId: string
  storyTitle: string
  isOwner?: boolean
}

export function ShareDialog({ open, onOpenChange, storyId, storyTitle, isOwner = true }: ShareDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const { data: collaborators = [] } = useCollaborators(storyId)
  const { data: searchResults = [], isLoading: searchLoading } = useSearchUsers(searchQuery)
  const removeCollaborator = useRemoveCollaborator()
  const inviteUser = useInviteUser()

  // Clear messages after delay
  useEffect(() => {
    if (inviteSuccess) {
      const timer = setTimeout(() => setInviteSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [inviteSuccess])

  useEffect(() => {
    if (inviteError) {
      const timer = setTimeout(() => setInviteError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [inviteError])

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!confirm('Remove this collaborator? They will lose access to this project.')) return
    try {
      await removeCollaborator.mutateAsync({ collaboratorId, storyId })
    } catch (error: any) {
      console.error('Failed to remove collaborator:', error)
      setInviteError(error.message || 'Failed to remove collaborator')
    }
  }

  const handleInviteUser = async (userId: string, displayName: string) => {
    try {
      setInviteError(null)
      await inviteUser.mutateAsync({
        storyId,
        userId,
        role: inviteRole
      })
      setInviteSuccess(`Invitation sent to ${displayName}`)
      setSearchQuery('')
    } catch (error: any) {
      setInviteError(error.message || 'Failed to invite user')
    }
  }

  const acceptedCollaborators = collaborators.filter(c => c.accepted_at)
  const pendingCollaborators = collaborators.filter(c => !c.accepted_at)
  const collaboratorIds = collaborators.map(c => c.user_id)

  // Filter out users who are already collaborators or have pending invites
  const filteredSearchResults = searchResults.filter(
    user => !collaboratorIds.includes(user.id)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isOwner ? `Share "${storyTitle}"` : `Team - "${storyTitle}"`}
          </DialogTitle>
          <DialogDescription>
            {isOwner ? 'Invite others to collaborate on your project' : 'View the collaborators on this project'}
          </DialogDescription>
        </DialogHeader>

        {/* Beta Warning Banner */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                Collaborative Mode is in Beta
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300/90">
                Collaborative Mode is still being developed and may have bugs or unexpected behavior.
                Use at your own risk. It is recommended to keep backups of important work.
                Once confirmed as fully functional, Collaborative Mode will become a paid feature.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 py-4">
          {/* Invite by Username/Email - only show to owner */}
          {isOwner && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Invite Collaborator</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Role selector - viewer mode disabled for now */}
              <div className="px-3 py-2 border rounded-md bg-muted text-sm text-muted-foreground">
                Editor
              </div>
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div className="space-y-1">
                {searchLoading ? (
                  <p className="text-sm text-muted-foreground py-2">Searching...</p>
                ) : filteredSearchResults.length > 0 ? (
                  filteredSearchResults.map((user) => {
                    const isEmailSearch = searchQuery.includes('@')
                    return (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => handleInviteUser(user.id, user.username || user.email || 'User')}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {(user.username || user.email || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {user.username && (
                            <div className="text-sm font-medium flex items-center gap-1">
                              <AtSign className="w-3 h-3" />
                              {user.username}
                            </div>
                          )}
                          {isEmailSearch && user.email && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          )}
                        </div>
                        <UserPlus className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No users found</p>
                )}
              </div>
            )}

            {/* Success/Error Messages */}
            {inviteSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" />
                {inviteSuccess}
              </p>
            )}
            {inviteError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <X className="w-4 h-4" />
                {inviteError}
              </p>
            )}
          </div>
          )}

          {/* Pending Invitations - only show to owner */}
          {isOwner && pendingCollaborators.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Pending Invitations</h3>
              <div className="space-y-2">
                {pendingCollaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-dashed"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {collab.profile?.username || collab.profile?.email || 'Unknown User'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Edit3 className="w-3 h-3" />
                        <span>Invited as Editor</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveCollaborator(collab.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      title="Cancel invitation"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collaborators */}
          {acceptedCollaborators.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Collaborators</h3>
              <div className="space-y-2">
                {acceptedCollaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {(collab.profile?.username || collab.profile?.email || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {collab.profile?.username || collab.profile?.email || 'Unknown User'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {collab.role === 'editor' ? (
                          <>
                            <Edit3 className="w-3 h-3" />
                            <span>Can Edit</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>View Only</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveCollaborator(collab.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {pendingCollaborators.length === 0 && acceptedCollaborators.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No collaborators yet</p>
              {isOwner && <p className="text-xs mt-1">Search for users above to send an invitation</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
