-- Fix Invitation Visibility and Decline Button
-- Run this in the Supabase SQL editor
-- This fixes two issues:
-- 1. Stories appearing on dashboard before invitation is accepted
-- 2. Decline invitation button not working (Issue 8)

-- First, drop any existing conflicting policies on stories SELECT
DROP POLICY IF EXISTS "Users can view own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view own or collaborated stories" ON public.stories;

-- Create the correct policy: Only show stories where user owns OR has ACCEPTED collaboration
CREATE POLICY "Users can view own or collaborated stories"
  ON public.stories FOR SELECT
  USING (
    user_id = auth.uid()
    OR id IN (
      SELECT story_id FROM public.story_collaborators
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Issue 8 Fix: Allow users to decline their own invitations
-- This policy lets users delete their OWN collaboration records (decline invitations)
DROP POLICY IF EXISTS "Users can decline their own invitations" ON public.story_collaborators;
CREATE POLICY "Users can decline their own invitations"
  ON public.story_collaborators FOR DELETE
  USING (user_id = auth.uid());

-- Verify the policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('stories', 'story_collaborators')
ORDER BY tablename, policyname;
