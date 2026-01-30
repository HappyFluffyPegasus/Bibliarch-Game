-- Collaboration Schema for Bibliarch
-- Run this in the Supabase SQL editor to add collaboration support

-- Create story_collaborators table to track who has access to which stories
CREATE TABLE IF NOT EXISTS public.story_collaborators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor', -- 'editor' or 'viewer'
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(story_id, user_id)
);

-- Create share_tokens table for invite links
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor', -- role granted when accepting invite
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.story_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for story_collaborators
-- Users can see collaborators for stories they own or collaborate on
CREATE POLICY "Users can view collaborators for their stories"
  ON public.story_collaborators FOR SELECT
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Story owners can add collaborators
CREATE POLICY "Story owners can add collaborators"
  ON public.story_collaborators FOR INSERT
  WITH CHECK (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

-- Story owners can remove collaborators
CREATE POLICY "Story owners can remove collaborators"
  ON public.story_collaborators FOR DELETE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

-- Users can update their own collaboration (e.g., accept invite)
CREATE POLICY "Users can update their own collaboration"
  ON public.story_collaborators FOR UPDATE
  USING (user_id = auth.uid());

-- Policies for share_tokens
-- Story owners can manage their share tokens
CREATE POLICY "Story owners can view their share tokens"
  ON public.share_tokens FOR SELECT
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "Story owners can create share tokens"
  ON public.share_tokens FOR INSERT
  WITH CHECK (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "Story owners can delete share tokens"
  ON public.share_tokens FOR DELETE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

-- Anyone can read a token by its value (for joining)
CREATE POLICY "Anyone can lookup share tokens by token value"
  ON public.share_tokens FOR SELECT
  USING (true);

-- Update stories policies to allow collaborators to view stories
DROP POLICY IF EXISTS "Users can view own stories" ON public.stories;
CREATE POLICY "Users can view own or collaborated stories"
  ON public.stories FOR SELECT
  USING (
    user_id = auth.uid()
    OR id IN (
      SELECT story_id FROM public.story_collaborators
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Update canvas_data policies to allow collaborators access
DROP POLICY IF EXISTS "Users can manage own canvas data" ON public.canvas_data;
CREATE POLICY "Users can view canvas data for their stories or collaborations"
  ON public.canvas_data FOR SELECT
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
    OR story_id IN (
      SELECT story_id FROM public.story_collaborators
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert canvas data for their stories or collaborations"
  ON public.canvas_data FOR INSERT
  WITH CHECK (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
    OR story_id IN (
      SELECT story_id FROM public.story_collaborators
      WHERE user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role = 'editor'
    )
  );

CREATE POLICY "Users can update canvas data for their stories or collaborations"
  ON public.canvas_data FOR UPDATE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
    OR story_id IN (
      SELECT story_id FROM public.story_collaborators
      WHERE user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role = 'editor'
    )
  );

CREATE POLICY "Users can delete canvas data for their own stories only"
  ON public.canvas_data FOR DELETE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

-- Function to accept an invite via share token
CREATE OR REPLACE FUNCTION public.accept_share_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  token_record RECORD;
  result JSON;
BEGIN
  -- Find the token
  SELECT * INTO token_record
  FROM public.share_tokens
  WHERE token = invite_token;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite link');
  END IF;

  -- Check if expired
  IF token_record.expires_at IS NOT NULL AND token_record.expires_at < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'This invite link has expired');
  END IF;

  -- Check max uses
  IF token_record.max_uses IS NOT NULL AND token_record.use_count >= token_record.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'This invite link has reached its maximum uses');
  END IF;

  -- Check if user is the owner (can't invite yourself)
  IF EXISTS (SELECT 1 FROM public.stories WHERE id = token_record.story_id AND user_id = auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'You already own this story');
  END IF;

  -- Add as collaborator (or update if already exists)
  INSERT INTO public.story_collaborators (story_id, user_id, role, invited_by, accepted_at)
  VALUES (token_record.story_id, auth.uid(), token_record.role, token_record.created_by, NOW())
  ON CONFLICT (story_id, user_id)
  DO UPDATE SET accepted_at = NOW(), role = token_record.role;

  -- Increment use count
  UPDATE public.share_tokens
  SET use_count = use_count + 1
  WHERE id = token_record.id;

  RETURN json_build_object(
    'success', true,
    'story_id', token_record.story_id,
    'role', token_record.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for canvas_data (for live collaboration)
ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_data;

-- Create index for faster collaborator lookups
CREATE INDEX IF NOT EXISTS idx_story_collaborators_user_id ON public.story_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_story_collaborators_story_id ON public.story_collaborators(story_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON public.share_tokens(token);
