'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sparkles, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ token: string }>
}

export default function JoinPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<'loading' | 'checking' | 'ready' | 'joining' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [storyInfo, setStoryInfo] = useState<{ title: string; role: string } | null>(null)
  const [user, setUser] = useState<any>(null)

  // Check auth and token on mount
  useEffect(() => {
    async function checkToken() {
      // Check if user is authenticated
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(`/join/${resolvedParams.token}`)
        router.push(`/login?returnUrl=${returnUrl}`)
        return
      }

      setUser(currentUser)
      setStatus('checking')

      // Validate the token
      const { data: tokenData, error: tokenError } = await supabase
        .from('share_tokens')
        .select(`
          id,
          role,
          expires_at,
          max_uses,
          use_count,
          story:story_id (
            id,
            title,
            user_id
          )
        `)
        .eq('token', resolvedParams.token)
        .single()

      if (tokenError || !tokenData) {
        setStatus('error')
        setError('This invite link is invalid or has been deleted.')
        return
      }

      // Check if expired
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        setStatus('error')
        setError('This invite link has expired.')
        return
      }

      // Check max uses
      if (tokenData.max_uses && tokenData.use_count >= tokenData.max_uses) {
        setStatus('error')
        setError('This invite link has reached its maximum number of uses.')
        return
      }

      // Check if user is already the owner
      if ((tokenData.story as any)?.user_id === currentUser.id) {
        setStatus('error')
        setError('You already own this project.')
        return
      }

      // Check if already a collaborator
      const { data: existingCollab } = await supabase
        .from('story_collaborators')
        .select('id, accepted_at')
        .eq('story_id', (tokenData.story as any)?.id)
        .eq('user_id', currentUser.id)
        .single()

      if (existingCollab?.accepted_at) {
        // Already a collaborator, redirect to the story
        router.push(`/story/${(tokenData.story as any)?.id}`)
        return
      }

      // Token is valid, show join UI
      setStoryInfo({
        title: (tokenData.story as any)?.title || 'Untitled Project',
        role: tokenData.role
      })
      setStatus('ready')
    }

    checkToken()
  }, [resolvedParams.token, router, supabase])

  const handleJoin = async () => {
    setStatus('joining')

    try {
      const { data, error } = await supabase.rpc('accept_share_invite', {
        invite_token: resolvedParams.token
      })

      if (error) throw error

      if (!data.success) {
        setStatus('error')
        setError(data.error || 'Failed to join project')
        return
      }

      setStatus('success')

      // Redirect to the story after a brief delay
      setTimeout(() => {
        router.push(`/story/${data.story_id}`)
      }, 2000)
    } catch (err: any) {
      setStatus('error')
      setError(err.message || 'Failed to join project')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <Sparkles className="w-12 h-12 text-sky-600 dark:text-blue-400 mx-auto" />
          </div>

          {/* Loading State */}
          {(status === 'loading' || status === 'checking') && (
            <div className="space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-600" />
              <p className="text-muted-foreground">
                {status === 'loading' ? 'Checking authentication...' : 'Validating invite link...'}
              </p>
            </div>
          )}

          {/* Ready to Join */}
          {status === 'ready' && storyInfo && (
            <div className="space-y-6">
              <div>
                <Users className="w-16 h-16 text-sky-600 dark:text-blue-400 mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">You're Invited!</h1>
                <p className="text-muted-foreground">
                  You've been invited to collaborate on
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <h2 className="text-lg font-semibold">{storyInfo.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {storyInfo.role === 'editor' ? 'You will be able to edit this project' : 'You will have view-only access'}
                </p>
              </div>

              <Button
                onClick={handleJoin}
                className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
                size="lg"
              >
                Accept Invitation
              </Button>
            </div>
          )}

          {/* Joining */}
          {status === 'joining' && (
            <div className="space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-600" />
              <p className="text-muted-foreground">Joining project...</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h1 className="text-2xl font-bold">You're In!</h1>
              <p className="text-muted-foreground">
                Redirecting you to the project...
              </p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="space-y-6">
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <div>
                <h1 className="text-2xl font-bold mb-2">Unable to Join</h1>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
