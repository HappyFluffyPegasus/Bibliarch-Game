// Database types for Supabase
// These match our schema from 03-tech.md

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          username: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          username?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          username?: string | null
          created_at?: string
        }
      }
      stories: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
          settings: Json
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          created_at?: string
          updated_at?: string
          settings?: Json
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          created_at?: string
          updated_at?: string
          settings?: Json
        }
      }
      canvas_data: {
        Row: {
          id: string
          story_id: string
          canvas_type: string
          parent_id: string | null
          nodes: Json
          connections: Json
          updated_at: string
        }
        Insert: {
          id?: string
          story_id: string
          canvas_type: string
          parent_id?: string | null
          nodes?: Json
          connections?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          canvas_type?: string
          parent_id?: string | null
          nodes?: Json
          connections?: Json
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Story settings stored in the settings JSON column
export interface StorySettings {
  collaborationEnabled?: boolean
  // Add other settings here as needed
}