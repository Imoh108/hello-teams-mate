export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_generated_items: {
        Row: {
          choices: Json
          correct_index: number
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          job_id: string | null
          prompt: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          status: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          choices?: Json
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          job_id?: string | null
          prompt: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          choices?: Json
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          job_id?: string | null
          prompt?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_jobs: {
        Row: {
          approved_count: number
          created_at: string
          created_by: string | null
          error_message: string | null
          generated_count: number
          id: string
          prompt: string | null
          rejected_count: number
          source: string
          status: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          approved_count?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          generated_count?: number
          id?: string
          prompt?: string | null
          rejected_count?: number
          source: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          approved_count?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          generated_count?: number
          id?: string
          prompt?: string | null
          rejected_count?: number
          source?: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          country: string | null
          created_at: string
          event_type: string
          id: string
          org_id: string | null
          properties: Json
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          event_type: string
          id?: string
          org_id?: string | null
          properties?: Json
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string | null
          properties?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          answered_at: string
          flagged: boolean
          id: string
          is_correct: boolean
          points: number
          question_id: string
          selected_index: number | null
          session_id: string
          time_taken_ms: number
          user_id: string
        }
        Insert: {
          answered_at?: string
          flagged?: boolean
          id?: string
          is_correct?: boolean
          points?: number
          question_id: string
          selected_index?: number | null
          session_id: string
          time_taken_ms: number
          user_id: string
        }
        Update: {
          answered_at?: string
          flagged?: boolean
          id?: string
          is_correct?: boolean
          points?: number
          question_id?: string
          selected_index?: number | null
          session_id?: string
          time_taken_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_items: {
        Row: {
          category: string
          cost_points: number
          created_at: string
          created_by: string
          id: string
          image_url: string
          name: string
          org_id: string | null
          rarity: string
        }
        Insert: {
          category?: string
          cost_points?: number
          created_at?: string
          created_by: string
          id?: string
          image_url: string
          name: string
          org_id?: string | null
          rarity?: string
        }
        Update: {
          category?: string
          cost_points?: number
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string
          name?: string
          org_id?: string | null
          rarity?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string
          created_by: string
          criteria_type: string
          criteria_value: number | null
          description: string | null
          icon: string
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          criteria_type?: string
          criteria_value?: number | null
          description?: string | null
          icon?: string
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          criteria_type?: string
          criteria_value?: number | null
          description?: string | null
          icon?: string
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_questions: {
        Row: {
          bank_id: string
          choices: Json
          correct_index: number
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          position: number
          prompt: string
          updated_at: string
        }
        Insert: {
          bank_id: string
          choices?: Json
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          position?: number
          prompt: string
          updated_at?: string
        }
        Update: {
          bank_id?: string
          choices?: Json
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          position?: number
          prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_questions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_tags: {
        Row: {
          bank_id: string
          created_at: string
          id: string
          tag: string
        }
        Insert: {
          bank_id: string
          created_at?: string
          id?: string
          tag: string
        }
        Update: {
          bank_id?: string
          created_at?: string
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_tags_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed_at: string | null
          current_progress: number
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          current_progress?: number
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          current_progress?: number
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_at: string
          id: string
          name: string
          org_id: string
          reward_badge_id: string | null
          start_at: string
          target_points: number
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_at: string
          id?: string
          name: string
          org_id: string
          reward_badge_id?: string | null
          start_at?: string
          target_points?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_at?: string
          id?: string
          name?: string
          org_id?: string
          reward_badge_id?: string | null
          start_at?: string
          target_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_reward_badge_id_fkey"
            columns: ["reward_badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          license: string | null
          name: string
          notes: string | null
          topic: string | null
          updated_at: string
          url: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          license?: string | null
          name: string
          notes?: string | null
          topic?: string | null
          updated_at?: string
          url: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          license?: string | null
          name?: string
          notes?: string | null
          topic?: string | null
          updated_at?: string
          url?: string
          verified?: boolean
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          org_role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          org_role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          org_id: string
          org_role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          org_id: string
          org_role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          org_id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          data_backend: Database["public"]["Enums"]["org_data_backend"]
          default_locale: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data_backend?: Database["public"]["Enums"]["org_data_backend"]
          default_locale?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data_backend?: Database["public"]["Enums"]["org_data_backend"]
          default_locale?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      point_events: {
        Row: {
          created_at: string
          delta: number
          id: string
          org_id: string | null
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          org_id?: string | null
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          org_id?: string | null
          ref_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          equipped_avatar_id: string | null
          id: string
          points: number
          preferred_locale: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          equipped_avatar_id?: string | null
          id: string
          points?: number
          preferred_locale?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          equipped_avatar_id?: string | null
          id?: string
          points?: number
          preferred_locale?: string
        }
        Relationships: []
      }
      question_banks: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_banks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_index: number
          created_at: string
          id: string
          options: Json
          position: number
          prompt: string
          quiz_id: string
          time_limit_s: number
        }
        Insert: {
          correct_index: number
          created_at?: string
          id?: string
          options: Json
          position: number
          prompt: string
          quiz_id: string
          time_limit_s?: number
        }
        Update: {
          correct_index?: number
          created_at?: string
          id?: string
          options?: Json
          position?: number
          prompt?: string
          quiz_id?: string
          time_limit_s?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          is_public: boolean
          org_id: string | null
          owner_id: string | null
          title: string
          topic_pack: Database["public"]["Enums"]["topic_pack"]
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          org_id?: string | null
          owner_id?: string | null
          title: string
          topic_pack?: Database["public"]["Enums"]["topic_pack"]
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          org_id?: string | null
          owner_id?: string | null
          title?: string
          topic_pack?: Database["public"]["Enums"]["topic_pack"]
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_players: {
        Row: {
          display_name: string
          flagged_count: number
          id: string
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          flagged_count?: number
          id?: string
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          flagged_count?: number
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          current_question_id: string | null
          department_id: string | null
          ended_at: string | null
          host_id: string
          id: string
          join_code: string
          org_id: string | null
          question_started_at: string | null
          quiz_id: string
          status: Database["public"]["Enums"]["session_status"]
          time_limit_override_s: number | null
        }
        Insert: {
          created_at?: string
          current_question_id?: string | null
          department_id?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          join_code: string
          org_id?: string | null
          question_started_at?: string | null
          quiz_id: string
          status?: Database["public"]["Enums"]["session_status"]
          time_limit_override_s?: number | null
        }
        Update: {
          created_at?: string
          current_question_id?: string | null
          department_id?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          join_code?: string
          org_id?: string | null
          question_started_at?: string | null
          quiz_id?: string
          status?: Database["public"]["Enums"]["session_status"]
          time_limit_override_s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_documents: {
        Row: {
          bank_id: string | null
          created_at: string
          department_id: string | null
          error: string | null
          extracted_text: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string
          org_id: string
          size_bytes: number
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          bank_id?: string | null
          created_at?: string
          department_id?: string | null
          error?: string | null
          extracted_text?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          org_id: string
          size_bytes?: number
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          bank_id?: string | null
          created_at?: string
          department_id?: string | null
          error?: string | null
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          org_id?: string
          size_bytes?: number
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_documents_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_avatar_items: {
        Row: {
          acquired_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatar_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          org_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          org_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          org_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_points: {
        Args: {
          _delta: number
          _org: string
          _ref?: string
          _source: string
          _user: string
        }
        Returns: number
      }
      has_org_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["org_role"]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_session_host: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      is_session_player: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      org_has_tier: {
        Args: {
          _min: Database["public"]["Enums"]["subscription_tier"]
          _org: string
        }
        Returns: boolean
      }
      org_tier: {
        Args: { _org: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      tier_rank: {
        Args: { _t: Database["public"]["Enums"]["subscription_tier"] }
        Returns: number
      }
    }
    Enums: {
      app_role: "manager" | "player" | "platform_admin"
      org_data_backend: "lovable_cloud" | "dataverse"
      org_role: "owner" | "admin" | "hr" | "team_lead" | "member"
      session_status: "lobby" | "active" | "reveal" | "ended"
      subscription_tier: "basic" | "premium" | "enterprise"
      topic_pack:
        | "company_trivia"
        | "industry_knowledge"
        | "general_culture"
        | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["manager", "player", "platform_admin"],
      org_data_backend: ["lovable_cloud", "dataverse"],
      org_role: ["owner", "admin", "hr", "team_lead", "member"],
      session_status: ["lobby", "active", "reveal", "ended"],
      subscription_tier: ["basic", "premium", "enterprise"],
      topic_pack: [
        "company_trivia",
        "industry_knowledge",
        "general_culture",
        "custom",
      ],
    },
  },
} as const
