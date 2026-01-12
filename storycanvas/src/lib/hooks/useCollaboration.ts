import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

// Types
export interface Collaborator {
  id: string
  user_id: string
  role: 'editor' | 'viewer'
  invited_at: string
  accepted_at: string | null
  profile?: {
    username: string | null
    email: string | null
  }
}

export interface ShareToken {
  id: string
  token: string
  role: 'editor' | 'viewer'
  expires_at: string | null
  max_uses: number | null
  use_count: number
  created_at: string
}

export interface PresenceState {
  odataUserId: string
  username: string
  color: string
  cursor?: { x: number; y: number }
  lastSeen: number
}

// Query keys
export const collabQueryKeys = {
  collaborators: (storyId: string) => ['collaborators', storyId] as const,
  shareTokens: (storyId: string) => ['shareTokens', storyId] as const,
  isCollaborator: (storyId: string) => ['isCollaborator', storyId] as const,
}

// Generate a random color for cursor
function generateUserColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Generate a short random token
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Check if current user is owner or collaborator of a story
export function useStoryAccess(storyId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: storyId ? collabQueryKeys.isCollaborator(storyId) : ['isCollaborator', 'null'],
    queryFn: async () => {
      if (!storyId) return { isOwner: false, isCollaborator: false, role: null }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { isOwner: false, isCollaborator: false, role: null }

      // Check if owner
      const { data: story } = await supabase
        .from('stories')
        .select('id, user_id')
        .eq('id', storyId)
        .single()

      if (story?.user_id === user.id) {
        return { isOwner: true, isCollaborator: false, role: 'owner' as const }
      }

      // Check if collaborator
      const { data: collab } = await supabase
        .from('story_collaborators')
        .select('role, accepted_at')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .single()

      if (collab?.accepted_at) {
        return { isOwner: false, isCollaborator: true, role: collab.role as 'editor' | 'viewer' }
      }

      return { isOwner: false, isCollaborator: false, role: null }
    },
    enabled: !!storyId,
  })
}

// Get collaborators for a story
export function useCollaborators(storyId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: storyId ? collabQueryKeys.collaborators(storyId) : ['collaborators', 'null'],
    queryFn: async () => {
      if (!storyId) return []

      const { data, error } = await supabase
        .from('story_collaborators')
        .select(`
          id,
          user_id,
          role,
          invited_at,
          accepted_at,
          profile:profiles!user_id (
            username,
            email
          )
        `)
        .eq('story_id', storyId)

      if (error) throw error
      return (data || []) as Collaborator[]
    },
    enabled: !!storyId,
  })
}

// Get share tokens for a story
export function useShareTokens(storyId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: storyId ? collabQueryKeys.shareTokens(storyId) : ['shareTokens', 'null'],
    queryFn: async () => {
      if (!storyId) return []

      const { data, error } = await supabase
        .from('share_tokens')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as ShareToken[]
    },
    enabled: !!storyId,
  })
}

// Create a share token
export function useCreateShareToken() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      storyId,
      role = 'editor',
      expiresIn,
      maxUses
    }: {
      storyId: string
      role?: 'editor' | 'viewer'
      expiresIn?: number // hours
      maxUses?: number
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const token = generateToken()
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 60 * 60 * 1000).toISOString()
        : null

      const { data, error } = await supabase
        .from('share_tokens')
        .insert({
          story_id: storyId,
          token,
          created_by: user.id,
          role,
          expires_at: expiresAt,
          max_uses: maxUses || null
        })
        .select()
        .single()

      if (error) throw error
      return data as ShareToken
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collabQueryKeys.shareTokens(variables.storyId) })
    },
  })
}

// Delete a share token
export function useDeleteShareToken() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tokenId, storyId }: { tokenId: string; storyId: string }) => {
      const { error } = await supabase
        .from('share_tokens')
        .delete()
        .eq('id', tokenId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collabQueryKeys.shareTokens(variables.storyId) })
    },
  })
}

// Accept a share invite
export function useAcceptInvite() {
  const supabase = createClient()

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_share_invite', {
        invite_token: token
      })

      if (error) throw error
      return data as { success: boolean; story_id?: string; role?: string; error?: string }
    },
  })
}

// Remove a collaborator
export function useRemoveCollaborator() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ collaboratorId, storyId }: { collaboratorId: string; storyId: string }) => {
      const { error } = await supabase
        .from('story_collaborators')
        .delete()
        .eq('id', collaboratorId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collabQueryKeys.collaborators(variables.storyId) })
    },
  })
}

// Search for users by username or email
export function useSearchUsers(query: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['searchUsers', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []

      const { data: { user: currentUser } } = await supabase.auth.getUser()

      // Check if query looks like an email (contains @)
      const isEmailSearch = query.includes('@')

      let data, error

      if (isEmailSearch) {
        // For email: require EXACT match (case insensitive) for privacy
        const result = await supabase
          .from('profiles')
          .select('id, username, email')
          .ilike('email', query)
          .neq('id', currentUser?.id || '')
          .limit(10)
        data = result.data
        error = result.error
      } else {
        // For username: allow partial match but require at least 3 chars
        if (query.length < 3) return []
        const result = await supabase
          .from('profiles')
          .select('id, username, email')
          .ilike('username', `%${query}%`)
          .neq('id', currentUser?.id || '')
          .limit(10)
        data = result.data
        error = result.error
      }

      if (error) throw error
      return data || []
    },
    enabled: query.length >= 2,
  })
}

// Invite a user directly by their profile ID (creates pending invitation)
export function useInviteUser() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      storyId,
      userId,
      role = 'editor'
    }: {
      storyId: string
      userId: string
      role?: 'editor' | 'viewer'
    }) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Not authenticated')

      // Check if user is already a collaborator or has pending invite
      const { data: existing } = await supabase
        .from('story_collaborators')
        .select('id, accepted_at')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .single()

      if (existing) {
        if (existing.accepted_at) {
          throw new Error('User is already a collaborator')
        } else {
          throw new Error('Invitation already sent')
        }
      }

      // Add as pending collaborator (no accepted_at = pending)
      const { data, error } = await supabase
        .from('story_collaborators')
        .insert({
          story_id: storyId,
          user_id: userId,
          role,
          invited_by: currentUser.id
          // accepted_at is null = pending invitation
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collabQueryKeys.collaborators(variables.storyId) })
    },
  })
}

// Get pending invitations for current user
export function useMyInvitations() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['myInvitations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // First get the collaborator records with story_id
      const { data: collabData, error: collabError } = await supabase
        .from('story_collaborators')
        .select(`
          id,
          story_id,
          role,
          invited_at,
          invited_by
        `)
        .eq('user_id', user.id)
        .is('accepted_at', null)
        .order('invited_at', { ascending: false })

      if (collabError) throw collabError
      if (!collabData || collabData.length === 0) return []

      // Get story titles separately (using service role or direct query)
      // Since RLS blocks the join, we fetch story info via a separate approach
      const storyIds = collabData.map(c => c.story_id)
      const inviterIds = collabData.map(c => c.invited_by).filter(Boolean)

      // Fetch story titles - this works because we query stories table directly
      // and the RLS will be bypassed for the title fetch since we're getting specific IDs
      const { data: stories } = await supabase
        .from('stories')
        .select('id, title')
        .in('id', storyIds)

      // Fetch inviter profiles
      const { data: inviters } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', inviterIds)

      // Combine the data
      const storiesMap = new Map(stories?.map(s => [s.id, s]) || [])
      const invitersMap = new Map(inviters?.map(i => [i.id, i]) || [])

      return collabData.map(collab => ({
        id: collab.id,
        role: collab.role,
        invited_at: collab.invited_at,
        story: {
          id: collab.story_id,
          title: storiesMap.get(collab.story_id)?.title || 'Untitled Project'
        },
        inviter: invitersMap.get(collab.invited_by) || null
      }))
    },
  })
}

// Accept an invitation
export function useAcceptInvitation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (collaboratorId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('story_collaborators')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', collaboratorId)
        .eq('user_id', user.id) // Security: only accept own invitations
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myInvitations'] })
    },
  })
}

// Decline an invitation
export function useDeclineInvitation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ collaboratorId, storyId }: { collaboratorId: string; storyId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('story_collaborators')
        .delete()
        .eq('id', collaboratorId)
        .eq('user_id', user.id) // Security: only decline own invitations

      if (error) throw error
      return { storyId }
    },
    onSuccess: (data) => {
      // Invalidate both the user's invitations and the story's collaborators list
      // This ensures User A sees the removal when they check their collaborators
      queryClient.invalidateQueries({ queryKey: ['myInvitations'] })
      if (data?.storyId) {
        queryClient.invalidateQueries({ queryKey: collabQueryKeys.collaborators(data.storyId) })
      }
    },
  })
}

// Connection status type
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

// Locked node info
export interface LockedNode {
  nodeId: string
  odataUserId: string
  username: string
  field: string // which field is being edited
}

// Real-time canvas collaboration hook using Broadcast (no database dependency)
// Always stays connected when on a canvas and broadcasts all changes
export function useRealtimeCanvas(
  storyId: string | null,
  canvasType: string,
  onRemoteChange: (data: { nodes: any[]; connections: any[]; userId: string }) => void,
  onNodeLock?: (data: LockedNode) => void,
  onNodeUnlock?: (data: { nodeId: string; odataUserId: string }) => void
) {
  // Use ref for supabase client to avoid recreating channel on every render
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef<string | null>(null)
  const [userIdLoaded, setUserIdLoaded] = useState(false) // Track when userId is ready
  const onRemoteChangeRef = useRef(onRemoteChange)
  const onNodeLockRef = useRef(onNodeLock)
  const onNodeUnlockRef = useRef(onNodeUnlock)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')

  // Keep refs in sync with props (avoid re-running effects)
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange
  }, [onRemoteChange])

  useEffect(() => {
    onNodeLockRef.current = onNodeLock
  }, [onNodeLock])

  useEffect(() => {
    onNodeUnlockRef.current = onNodeUnlock
  }, [onNodeUnlock])

  // Get current user ID once before subscribing to channels
  // CRITICAL: Must complete before channel subscription to prevent echo loops
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id || null
      setUserIdLoaded(true) // Signal that userId is ready
      console.log('📡 User ID loaded for broadcast filtering:', userIdRef.current)
    })
  }, [supabase])

  // Subscribe to broadcast channel - stays connected while on canvas
  // Only depends on storyId and canvasType (not othersPresent or callbacks)
  // CRITICAL: Also depends on userIdLoaded to prevent echo loops
  useEffect(() => {
    if (!storyId) {
      setConnectionStatus('disconnected')
      return
    }

    // CRITICAL FIX: Wait for userId to be loaded before subscribing
    // This prevents processing own broadcasts if they arrive before userId is set
    if (!userIdLoaded) {
      console.log('📡 Waiting for user ID to load before subscribing to channel')
      setConnectionStatus('connecting')
      return
    }

    // CRITICAL FIX: Cleanup existing channel before creating new one
    // This prevents memory leaks when canvas changes rapidly
    if (channelRef.current) {
      console.log('📡 Cleaning up existing channel before creating new one')
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    setConnectionStatus('connecting')
    console.log('📡 Subscribing to broadcast channel:', `canvas-collab:${storyId}:${canvasType}`)

    const channel = supabase
      .channel(`canvas-collab:${storyId}:${canvasType}`)
      .on('broadcast', { event: 'canvas-update' }, (payload) => {
        // Don't process our own changes
        if (payload.payload?.userId === userIdRef.current) return

        console.log('📡 Received broadcast:', payload.payload?.nodes?.length, 'nodes')
        onRemoteChangeRef.current({
          nodes: payload.payload?.nodes || [],
          connections: payload.payload?.connections || [],
          userId: payload.payload?.userId || 'remote'
        })
      })
      .on('broadcast', { event: 'node-lock' }, (payload) => {
        // Don't process our own lock messages
        if (payload.payload?.odataUserId === userIdRef.current) return

        console.log('🔒 Received node lock:', payload.payload?.nodeId)
        onNodeLockRef.current?.({
          nodeId: payload.payload?.nodeId,
          odataUserId: payload.payload?.odataUserId,
          username: payload.payload?.username,
          field: payload.payload?.field
        })
      })
      .on('broadcast', { event: 'node-unlock' }, (payload) => {
        // Don't process our own unlock messages
        if (payload.payload?.odataUserId === userIdRef.current) return

        console.log('🔓 Received node unlock:', payload.payload?.nodeId)
        onNodeUnlockRef.current?.({
          nodeId: payload.payload?.nodeId,
          odataUserId: payload.payload?.odataUserId
        })
      })
      .subscribe((status) => {
        console.log('📡 Broadcast channel status:', status)
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected')
        } else {
          setConnectionStatus('connecting')
        }
      })

    channelRef.current = channel

    return () => {
      console.log('📡 Cleaning up broadcast channel')
      channel.unsubscribe()
      channelRef.current = null
      setConnectionStatus('disconnected')
    }
  }, [storyId, canvasType, userIdLoaded])

  // Store the current canvas type for logging
  const canvasTypeRef = useRef(canvasType)
  useEffect(() => {
    canvasTypeRef.current = canvasType
  }, [canvasType])

  // Return a function to broadcast changes
  // Always broadcast when connected - the channel filters out messages when no listeners
  const broadcastChange = useCallback(async (nodes: any[], connections: any[]) => {
    console.log('📡 broadcastChange called, channelRef:', !!channelRef.current, 'userId:', userIdRef.current, 'canvas:', canvasTypeRef.current)
    if (channelRef.current) {
      console.log('📡 Broadcasting:', nodes.length, 'nodes to canvas:', canvasTypeRef.current)
      try {
        const result = await channelRef.current.send({
          type: 'broadcast',
          event: 'canvas-update',
          payload: {
            nodes,
            connections,
            userId: userIdRef.current
          }
        })
        console.log('📡 Broadcast result:', result)
      } catch (err) {
        console.error('📡 Broadcast error:', err)
      }
    } else {
      console.log('📡 Cannot broadcast - no channel')
    }
  }, [])

  // Broadcast node lock (when user starts editing)
  const broadcastNodeLock = useCallback((nodeId: string, field: string, username: string) => {
    if (channelRef.current && userIdRef.current) {
      console.log('🔒 Broadcasting node lock:', nodeId, field)
      channelRef.current.send({
        type: 'broadcast',
        event: 'node-lock',
        payload: {
          nodeId,
          field,
          odataUserId: userIdRef.current,
          username
        }
      })
    }
  }, [])

  // Broadcast node unlock (when user stops editing)
  const broadcastNodeUnlock = useCallback((nodeId: string) => {
    if (channelRef.current && userIdRef.current) {
      console.log('🔓 Broadcasting node unlock:', nodeId)
      channelRef.current.send({
        type: 'broadcast',
        event: 'node-unlock',
        payload: {
          nodeId,
          odataUserId: userIdRef.current
        }
      })
    }
  }, [])

  return { broadcastChange, broadcastNodeLock, broadcastNodeUnlock, connectionStatus }
}

// Story-level coordination hook - for cross-canvas communication like save requests
// All users in a story subscribe to this channel regardless of which canvas they're on
export function useStoryCoordination(
  storyId: string | null,
  onSaveRequest?: () => void
) {
  console.log('🔧 [STORY-COORD] Hook called with storyId:', storyId)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef<string | null>(null)
  const [userIdLoaded, setUserIdLoaded] = useState(false) // Track when userId is ready
  const onSaveRequestRef = useRef(onSaveRequest)

  console.log('🔧 [STORY-COORD] channelRef.current is:', channelRef.current ? 'CHANNEL EXISTS' : 'NULL')

  // Keep ref in sync
  useEffect(() => {
    onSaveRequestRef.current = onSaveRequest
  }, [onSaveRequest])

  // Get current user ID before subscribing
  // CRITICAL: Must complete before channel subscription to prevent echo loops
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id || null
      setUserIdLoaded(true) // Signal that userId is ready
      console.log('📡 User ID loaded for story coordination:', userIdRef.current)
    })
  }, [supabase])

  // Subscribe to story-level coordination channel
  useEffect(() => {
    console.log('🔧 [STORY-COORD] useEffect running with storyId:', storyId)

    if (!storyId) {
      console.log('🔧 [STORY-COORD] Exiting early - no storyId')
      return
    }

    // CRITICAL FIX: Cleanup existing channel before creating new one
    if (channelRef.current) {
      console.log('📡 Cleaning up existing story coordination channel before creating new one')
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    console.log('📡 Subscribing to story coordination channel:', `story-coord:${storyId}`)

    const channel = supabase
      .channel(`story-coord:${storyId}`)
      .on('broadcast', { event: 'save-request' }, (payload) => {
        console.log('💾 [STORY-LEVEL] Received broadcast event:', payload)

        // Don't process our own save requests
        // Only filter if we have a userId AND it matches (defensive check)
        if (userIdRef.current && payload.payload?.userId === userIdRef.current) {
          console.log('💾 [STORY-LEVEL] Ignoring own save request (userId matches)')
          return
        }

        console.log('💾 [STORY-LEVEL] Processing save request from another user')
        console.log('💾 [STORY-LEVEL] onSaveRequestRef.current exists:', !!onSaveRequestRef.current)

        if (onSaveRequestRef.current) {
          onSaveRequestRef.current()
        } else {
          console.error('💾 [STORY-LEVEL] onSaveRequestRef.current is null!')
        }
      })
      .subscribe((status) => {
        console.log('📡 Story coordination channel status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('📡 Story coordination channel SUBSCRIBED successfully for story:', storyId)
        }
      })

    channelRef.current = channel
    console.log('🔧 [STORY-COORD] Channel created and assigned to ref:', !!channelRef.current)

    return () => {
      console.log('📡 Cleaning up story coordination channel')
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [storyId])

  // Broadcast save request to ALL users in the story (regardless of canvas)
  const broadcastSaveRequest = useCallback(() => {
    console.log('💾 [STORY-LEVEL] broadcastSaveRequest called')
    console.log('💾 [STORY-LEVEL] channelRef exists:', !!channelRef.current)
    console.log('💾 [STORY-LEVEL] userIdRef:', userIdRef.current)

    if (!channelRef.current) {
      console.error('💾 [STORY-LEVEL] Cannot broadcast - no channel!')
      return
    }

    if (!userIdRef.current) {
      console.error('💾 [STORY-LEVEL] Cannot broadcast - no userId yet!')
      return
    }

    console.log('💾 [STORY-LEVEL] Broadcasting save request to ALL users in story')
    channelRef.current.send({
      type: 'broadcast',
      event: 'save-request',
      payload: {
        userId: userIdRef.current
      }
    }).then((result) => {
      console.log('💾 [STORY-LEVEL] Broadcast result:', result)
    }).catch((err) => {
      console.error('💾 [STORY-LEVEL] Broadcast error:', err)
    })
  }, [])

  return { broadcastSaveRequest }
}

// Presence hook for showing online collaborators (cursor tracking removed for performance)
export function usePresence(
  storyId: string | null,
  canvasType: string,
  username: string
) {
  // Use ref for supabase client to avoid recreating channel on every render
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [presenceState, setPresenceState] = useState<Record<string, PresenceState>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userColorRef = useRef<string>(generateUserColor())
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!storyId) return

    // CRITICAL FIX: Cleanup existing channel before creating new one
    if (channelRef.current) {
      console.log('👥 Cleaning up existing presence channel before creating new one')
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    let channel: RealtimeChannel | null = null

    const setupPresence = async () => {
      // Get current user ID first before setting up channel
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        currentUserIdRef.current = user.id
      }

      channel = supabase.channel(`presence:${storyId}:${canvasType}`, {
        config: {
          presence: {
            key: 'user',
          },
        },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel!.presenceState()
          const newPresence: Record<string, PresenceState> = {}

          console.log('👥 Presence sync - raw state:', JSON.stringify(state))
          console.log('👥 Current user ID:', currentUserIdRef.current)

          Object.entries(state).forEach(([key, value]) => {
            if (Array.isArray(value) && value.length > 0) {
              const presence = value[0] as any
              console.log('👥 Found presence:', presence.odataUserId, presence.username)
              // Filter out the current user (currentUserIdRef is now guaranteed to be set)
              if (presence.odataUserId !== currentUserIdRef.current) {
                newPresence[presence.odataUserId] = presence
              }
            }
          })

          console.log('👥 Final presence state (excluding self):', Object.keys(newPresence).length, 'users')
          setPresenceState(newPresence)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('👥 User joined:', newPresences)
          // Re-sync presence state on join
          const state = channel!.presenceState()
          const newPresence: Record<string, PresenceState> = {}

          Object.entries(state).forEach(([k, value]) => {
            if (Array.isArray(value) && value.length > 0) {
              const presence = value[0] as any
              if (presence.odataUserId !== currentUserIdRef.current) {
                newPresence[presence.odataUserId] = presence
              }
            }
          })

          setPresenceState(newPresence)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('👥 User left:', leftPresences)
          // Re-sync presence state on leave
          const state = channel!.presenceState()
          const newPresence: Record<string, PresenceState> = {}

          Object.entries(state).forEach(([k, value]) => {
            if (Array.isArray(value) && value.length > 0) {
              const presence = value[0] as any
              if (presence.odataUserId !== currentUserIdRef.current) {
                newPresence[presence.odataUserId] = presence
              }
            }
          })

          setPresenceState(newPresence)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && user) {
            await channel!.track({
              odataUserId: user.id,
              username: username || 'Anonymous',
              color: userColorRef.current,
              lastSeen: Date.now(),
            })
          }
        })

      channelRef.current = channel
    }

    setupPresence()

    return () => {
      if (channel) {
        channel.unsubscribe()
      }
    }
  }, [storyId, canvasType, username])

  return {
    presenceState,
    userColor: userColorRef.current,
  }
}
