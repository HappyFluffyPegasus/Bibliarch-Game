'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  useMyInvitations,
  useAcceptInvitation,
  useDeclineInvitation,
} from '@/lib/hooks/useCollaboration'
import { Mail, Check, X, Edit3, Eye, Users } from 'lucide-react'

// Type for invitation data returned by useMyInvitations
interface Invitation {
  id: string
  role: 'editor' | 'viewer'
  invited_at: string
  story: {
    id: string
    title: string
  }
  inviter: {
    username: string | null
    email: string | null
  } | null
}

export function InvitationsInbox() {
  const router = useRouter()
  const { data: invitations = [], isLoading } = useMyInvitations()
  const acceptInvitation = useAcceptInvitation()
  const declineInvitation = useDeclineInvitation()

  const handleAccept = async (invitationId: string, storyId: string) => {
    try {
      await acceptInvitation.mutateAsync(invitationId)
      // Navigate to the story after accepting
      router.push(`/story/${storyId}`)
    } catch (error) {
      console.error('Failed to accept invitation:', error)
    }
  }

  const handleDecline = async (invitationId: string, storyId: string) => {
    try {
      await declineInvitation.mutateAsync({ collaboratorId: invitationId, storyId })
    } catch (error) {
      console.error('Failed to decline invitation:', error)
    }
  }

  if (isLoading) {
    return null
  }

  if (invitations.length === 0) {
    return null
  }

  return (
    <Card className="p-4 mb-6 border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-5 h-5 text-sky-600" />
        <h3 className="font-medium">Project Invitations</h3>
        <span className="text-xs bg-sky-600 text-white px-2 py-0.5 rounded-full">
          {invitations.length}
        </span>
      </div>

      <div className="space-y-2">
        {(invitations as Invitation[]).map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center gap-3 p-3 bg-background rounded-lg border"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {invitation.story?.title || 'Untitled Project'}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>from {invitation.inviter?.username || invitation.inviter?.email || 'Unknown'}</span>
                <span className="text-xs">•</span>
                <span className="flex items-center gap-1">
                  {invitation.role === 'editor' ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {invitation.role === 'editor' ? 'Editor' : 'Viewer'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(invitation.id, invitation.story?.id)}
                disabled={declineInvitation.isPending}
                className="h-8"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleAccept(invitation.id, invitation.story?.id)}
                disabled={acceptInvitation.isPending}
                className="h-8 bg-sky-600 hover:bg-sky-700"
              >
                <Check className="w-4 h-4 mr-1" />
                Accept
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
