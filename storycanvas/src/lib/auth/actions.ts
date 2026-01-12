// Authentication actions for Bibliarch
// Professional auth with email confirmations and password reset

'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  
  // Extract form data
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string

  // First try to sign in (in case user exists)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (!signInError) {
    // User exists and password is correct
    redirect('/dashboard')
    return
  }

  // Sign up the user - Supabase will auto-confirm if settings are correct
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`
    }
  })

  if (error) {
    // If email exists but password is wrong, try to be helpful
    // Check both error message and code for robustness
    const isAlreadyRegistered =
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('user already registered') ||
      (error as any).code === 'user_already_exists' ||
      (error as any).status === 422
    if (isAlreadyRegistered) {
      return { error: 'Email already exists. Try signing in instead.' }
    }
    return { error: error.message }
  }

  // Create or update the profile with username
  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      username,
      email: email
    })

    if (profileError) {
      console.error('Error creating profile:', profileError)
    }

    // Check if email confirmation is required
    // If session exists, user is auto-confirmed (Supabase setting is OFF)
    // If no session, email confirmation is required (Supabase setting is ON)
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      // Email confirmation required
      return { needsConfirmation: true }
    }
  }

  // If we get here, user is auto-confirmed, redirect to dashboard
  redirect('/dashboard')
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  // Extract form data
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Sign in the user
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Redirect to dashboard after successful login
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  
  // Sign out the user
  await supabase.auth.signOut()
  
  // Redirect to home page
  redirect('/')
}