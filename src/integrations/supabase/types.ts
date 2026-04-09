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
      activities: {
        Row: {
          body: string | null
          business_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          from_stage: string | null
          id: string
          metadata: Json | null
          to_stage: string | null
          type: string
        }
        Insert: {
          body?: string | null
          business_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          type: string
        }
        Update: {
          body?: string | null
          business_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_classifications: {
        Row: {
          business_id: string
          business_type: string | null
          category: string | null
          classified_at: string
          classified_by: string | null
          gbp_confidence: string | null
          id: string
          match_status: string | null
          sf_score: number | null
          vertical: string | null
        }
        Insert: {
          business_id: string
          business_type?: string | null
          category?: string | null
          classified_at?: string
          classified_by?: string | null
          gbp_confidence?: string | null
          id?: string
          match_status?: string | null
          sf_score?: number | null
          vertical?: string | null
        }
        Update: {
          business_id?: string
          business_type?: string | null
          category?: string | null
          classified_at?: string
          classified_by?: string | null
          gbp_confidence?: string | null
          id?: string
          match_status?: string | null
          sf_score?: number | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_classifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          added_via: string | null
          address: string | null
          cim_uploaded_at: string | null
          cim_url: string | null
          created_at: string
          crm_stage: string
          deal_confidence_score: number | null
          ebitda_margin_verified: number | null
          ebitda_verified: boolean | null
          employee_count: number | null
          employee_count_source: string | null
          founded_year: number | null
          google_types: string[] | null
          id: string
          last_activity_at: string | null
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          place_id: string | null
          rating: number | null
          revenue_confidence: string | null
          revenue_est_high: number | null
          revenue_est_low: number | null
          revenue_est_sources: string[] | null
          revenue_verified: boolean | null
          revenue_verified_at: string | null
          revenue_verified_source: string | null
          revenue_verified_value: number | null
          review_count: number | null
          review_status: string
          review_status_set_at: string | null
          updated_at: string
          website: string | null
          website_score: number | null
          website_score_at: string | null
        }
        Insert: {
          added_via?: string | null
          address?: string | null
          cim_uploaded_at?: string | null
          cim_url?: string | null
          created_at?: string
          crm_stage?: string
          deal_confidence_score?: number | null
          ebitda_margin_verified?: number | null
          ebitda_verified?: boolean | null
          employee_count?: number | null
          employee_count_source?: string | null
          founded_year?: number | null
          google_types?: string[] | null
          id?: string
          last_activity_at?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          revenue_confidence?: string | null
          revenue_est_high?: number | null
          revenue_est_low?: number | null
          revenue_est_sources?: string[] | null
          revenue_verified?: boolean | null
          revenue_verified_at?: string | null
          revenue_verified_source?: string | null
          revenue_verified_value?: number | null
          review_count?: number | null
          review_status?: string
          review_status_set_at?: string | null
          updated_at?: string
          website?: string | null
          website_score?: number | null
          website_score_at?: string | null
        }
        Update: {
          added_via?: string | null
          address?: string | null
          cim_uploaded_at?: string | null
          cim_url?: string | null
          created_at?: string
          crm_stage?: string
          deal_confidence_score?: number | null
          ebitda_margin_verified?: number | null
          ebitda_verified?: boolean | null
          employee_count?: number | null
          employee_count_source?: string | null
          founded_year?: number | null
          google_types?: string[] | null
          id?: string
          last_activity_at?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          revenue_confidence?: string | null
          revenue_est_high?: number | null
          revenue_est_low?: number | null
          revenue_est_sources?: string[] | null
          revenue_verified?: boolean | null
          revenue_verified_at?: string | null
          revenue_verified_source?: string | null
          revenue_verified_value?: number | null
          review_count?: number | null
          review_status?: string
          review_status_set_at?: string | null
          updated_at?: string
          website?: string | null
          website_score?: number | null
          website_score_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          estimated_age: number | null
          id: string
          is_owner: boolean | null
          last_contacted_at: string | null
          linkedin_url: string | null
          name: string
          notes: string | null
          phone: string | null
          preferred_contact: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          estimated_age?: number | null
          id?: string
          is_owner?: boolean | null
          last_contacted_at?: string | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          estimated_age?: number | null
          id?: string
          is_owner?: boolean | null
          last_contacted_at?: string | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_documents: {
        Row: {
          business_id: string
          doc_type: string
          file_name: string
          file_size_kb: number | null
          file_type: string
          id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          business_id: string
          doc_type: string
          file_name: string
          file_size_kb?: number | null
          file_type: string
          id?: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          business_id?: string
          doc_type?: string
          file_name?: string
          file_size_kb?: number | null
          file_type?: string
          id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_memos: {
        Row: {
          business_id: string
          deal_breaker_fired: boolean
          export_format: string | null
          exported_at: string | null
          generated_at: string
          id: string
          investment_thesis: string | null
          model_used: string
          open_questions: string[] | null
          risk_flags: string[]
          sections: Json
          source_doc_ids: string[] | null
          suggested_next_step: string | null
          user_annotations: Json
          version: number
        }
        Insert: {
          business_id: string
          deal_breaker_fired?: boolean
          export_format?: string | null
          exported_at?: string | null
          generated_at?: string
          id?: string
          investment_thesis?: string | null
          model_used?: string
          open_questions?: string[] | null
          risk_flags?: string[]
          sections?: Json
          source_doc_ids?: string[] | null
          suggested_next_step?: string | null
          user_annotations?: Json
          version?: number
        }
        Update: {
          business_id?: string
          deal_breaker_fired?: boolean
          export_format?: string | null
          exported_at?: string | null
          generated_at?: string
          id?: string
          investment_thesis?: string | null
          model_used?: string
          open_questions?: string[] | null
          risk_flags?: string[]
          sections?: Json
          source_doc_ids?: string[] | null
          suggested_next_step?: string | null
          user_annotations?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dd_memos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_template: string
          created_at: string
          id: string
          is_active: boolean
          letter_number: number
          name: string
          subject_template: string
          target_vertical: string | null
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          id?: string
          is_active?: boolean
          letter_number?: number
          name: string
          subject_template: string
          target_vertical?: string | null
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          id?: string
          is_active?: boolean
          letter_number?: number
          name?: string
          subject_template?: string
          target_vertical?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          body_html: string | null
          body_text: string | null
          business_id: string
          contact_id: string | null
          created_at: string
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          letter_number: number | null
          opened_at: string | null
          replied_at: string | null
          reply_body: string | null
          response_classification: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          business_id: string
          contact_id?: string | null
          created_at?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          letter_number?: number | null
          opened_at?: string | null
          replied_at?: string | null
          reply_body?: string | null
          response_classification?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          business_id?: string
          contact_id?: string | null
          created_at?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          letter_number?: number | null
          opened_at?: string | null
          replied_at?: string | null
          reply_body?: string | null
          response_classification?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hierarchy_taxonomy: {
        Row: {
          business_type: string
          category: string
          created_at: string
          id: string
          sf_score: number
          vertical: string
        }
        Insert: {
          business_type: string
          category: string
          created_at?: string
          id?: string
          sf_score: number
          vertical: string
        }
        Update: {
          business_type?: string
          category?: string
          created_at?: string
          id?: string
          sf_score?: number
          vertical?: string
        }
        Relationships: []
      }
      naics_benchmarks: {
        Row: {
          business_type: string
          revenue_per_emp_high: number
          revenue_per_emp_low: number
          updated_at: string
        }
        Insert: {
          business_type: string
          revenue_per_emp_high: number
          revenue_per_emp_low: number
          updated_at?: string
        }
        Update: {
          business_type?: string
          revenue_per_emp_high?: number
          revenue_per_emp_low?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_zip: string | null
          display_name: string | null
          gmail_connected: boolean
          search_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_zip?: string | null
          display_name?: string | null
          gmail_connected?: boolean
          search_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_zip?: string | null
          display_name?: string | null
          gmail_connected?: boolean
          search_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    Enums: {},
  },
} as const
