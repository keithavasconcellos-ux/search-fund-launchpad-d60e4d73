export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      hierarchy_taxonomy: {
        Row: {
          id: string
          vertical: string
          category: string
          business_type: string
          sf_score: number
          created_at: string
        }
        Insert: {
          id?: string
          vertical: string
          category: string
          business_type: string
          sf_score: number
          created_at?: string
        }
        Update: {
          id?: string
          vertical?: string
          category?: string
          business_type?: string
          sf_score?: number
          created_at?: string
        }
        Relationships: []
      }
      naics_benchmarks: {
        Row: {
          business_type: string
          revenue_per_emp_low: number
          revenue_per_emp_high: number
          updated_at: string
        }
        Insert: {
          business_type: string
          revenue_per_emp_low: number
          revenue_per_emp_high: number
          updated_at?: string
        }
        Update: {
          business_type?: string
          revenue_per_emp_low?: number
          revenue_per_emp_high?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          display_name: string | null
          search_start_date: string | null
          default_zip: string | null
          gmail_connected: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          display_name?: string | null
          search_start_date?: string | null
          default_zip?: string | null
          gmail_connected?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          display_name?: string | null
          search_start_date?: string | null
          default_zip?: string | null
          gmail_connected?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          id: string
          place_id: string | null
          name: string
          address: string | null
          lat: number | null
          lng: number | null
          website: string | null
          phone: string | null
          google_types: string[] | null
          rating: number | null
          review_count: number | null
          employee_count: number | null
          employee_count_source: string | null
          founded_year: number | null
          crm_stage: string
          review_status: string
          review_status_set_at: string | null
          revenue_est_low: number | null
          revenue_est_high: number | null
          revenue_confidence: string | null
          revenue_est_sources: string[] | null
          revenue_verified: boolean | null
          revenue_verified_value: number | null
          revenue_verified_source: string | null
          revenue_verified_at: string | null
          ebitda_verified: boolean | null
          ebitda_margin_verified: number | null
          website_score: number | null
          website_score_at: string | null
          deal_confidence_score: number | null
          cim_url: string | null
          cim_uploaded_at: string | null
          added_via: string | null
          last_activity_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          place_id?: string | null
          name: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          website?: string | null
          phone?: string | null
          google_types?: string[] | null
          rating?: number | null
          review_count?: number | null
          employee_count?: number | null
          employee_count_source?: string | null
          founded_year?: number | null
          crm_stage?: string
          review_status?: string
          review_status_set_at?: string | null
          revenue_est_low?: number | null
          revenue_est_high?: number | null
          revenue_confidence?: string | null
          revenue_est_sources?: string[] | null
          revenue_verified?: boolean | null
          revenue_verified_value?: number | null
          revenue_verified_source?: string | null
          revenue_verified_at?: string | null
          ebitda_verified?: boolean | null
          ebitda_margin_verified?: number | null
          website_score?: number | null
          website_score_at?: string | null
          deal_confidence_score?: number | null
          cim_url?: string | null
          cim_uploaded_at?: string | null
          added_via?: string | null
          last_activity_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          place_id?: string | null
          name?: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          website?: string | null
          phone?: string | null
          google_types?: string[] | null
          rating?: number | null
          review_count?: number | null
          employee_count?: number | null
          employee_count_source?: string | null
          founded_year?: number | null
          crm_stage?: string
          review_status?: string
          review_status_set_at?: string | null
          revenue_est_low?: number | null
          revenue_est_high?: number | null
          revenue_confidence?: string | null
          revenue_est_sources?: string[] | null
          revenue_verified?: boolean | null
          revenue_verified_value?: number | null
          revenue_verified_source?: string | null
          revenue_verified_at?: string | null
          ebitda_verified?: boolean | null
          ebitda_margin_verified?: number | null
          website_score?: number | null
          website_score_at?: string | null
          deal_confidence_score?: number | null
          cim_url?: string | null
          cim_uploaded_at?: string | null
          added_via?: string | null
          last_activity_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      business_classifications: {
        Row: {
          id: string
          business_id: string
          vertical: string | null
          category: string | null
          business_type: string | null
          gbp_confidence: string | null
          match_status: string | null
          sf_score: number | null
          classified_at: string
          classified_by: string | null
        }
        Insert: {
          id?: string
          business_id: string
          vertical?: string | null
          category?: string | null
          business_type?: string | null
          gbp_confidence?: string | null
          match_status?: string | null
          sf_score?: number | null
          classified_at?: string
          classified_by?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          vertical?: string | null
          category?: string | null
          business_type?: string | null
          gbp_confidence?: string | null
          match_status?: string | null
          sf_score?: number | null
          classified_at?: string
          classified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_classifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      contacts: {
        Row: {
          id: string
          business_id: string
          name: string
          role: string | null
          email: string | null
          phone: string | null
          linkedin_url: string | null
          is_owner: boolean | null
          estimated_age: number | null
          preferred_contact: string | null
          notes: string | null
          last_contacted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          role?: string | null
          email?: string | null
          phone?: string | null
          linkedin_url?: string | null
          is_owner?: boolean | null
          estimated_age?: number | null
          preferred_contact?: string | null
          notes?: string | null
          last_contacted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          role?: string | null
          email?: string | null
          phone?: string | null
          linkedin_url?: string | null
          is_owner?: boolean | null
          estimated_age?: number | null
          preferred_contact?: string | null
          notes?: string | null
          last_contacted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      activities: {
        Row: {
          id: string
          business_id: string
          contact_id: string | null
          type: string
          body: string | null
          from_stage: string | null
          to_stage: string | null
          metadata: Json | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          contact_id?: string | null
          type: string
          body?: string | null
          from_stage?: string | null
          to_stage?: string | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          contact_id?: string | null
          type?: string
          body?: string | null
          from_stage?: string | null
          to_stage?: string | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      email_templates: {
        Row: {
          id: string
          name: string
          letter_number: number
          subject_template: string
          body_template: string
          target_vertical: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          letter_number?: number
          subject_template: string
          body_template: string
          target_vertical?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          letter_number?: number
          subject_template?: string
          body_template?: string
          target_vertical?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          id: string
          business_id: string
          contact_id: string | null
          template_id: string | null
          letter_number: number | null
          subject: string
          body_html: string | null
          body_text: string | null
          status: string
          response_classification: string | null
          sent_at: string | null
          opened_at: string | null
          replied_at: string | null
          reply_body: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          contact_id?: string | null
          template_id?: string | null
          letter_number?: number | null
          subject: string
          body_html?: string | null
          body_text?: string | null
          status?: string
          response_classification?: string | null
          sent_at?: string | null
          opened_at?: string | null
          replied_at?: string | null
          reply_body?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          contact_id?: string | null
          template_id?: string | null
          letter_number?: number | null
          subject?: string
          body_html?: string | null
          body_text?: string | null
          status?: string
          response_classification?: string | null
          sent_at?: string | null
          opened_at?: string | null
          replied_at?: string | null
          reply_body?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      dd_documents: {
        Row: {
          id: string
          business_id: string
          file_name: string
          file_type: string
          storage_path: string
          doc_type: string
          file_size_kb: number | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          business_id: string
          file_name: string
          file_type: string
          storage_path: string
          doc_type: string
          file_size_kb?: number | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          file_name?: string
          file_type?: string
          storage_path?: string
          doc_type?: string
          file_size_kb?: number | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      dd_memos: {
        Row: {
          id: string
          business_id: string
          source_doc_ids: string[] | null
          version: number
          model_used: string
          sections: Json
          user_annotations: Json
          risk_flags: string[]
          deal_breaker_fired: boolean
          investment_thesis: string | null
          open_questions: string[] | null
          suggested_next_step: string | null
          generated_at: string
          exported_at: string | null
          export_format: string | null
        }
        Insert: {
          id?: string
          business_id: string
          source_doc_ids?: string[] | null
          version?: number
          model_used?: string
          sections?: Json
          user_annotations?: Json
          risk_flags?: string[]
          deal_breaker_fired?: boolean
          investment_thesis?: string | null
          open_questions?: string[] | null
          suggested_next_step?: string | null
          generated_at?: string
          exported_at?: string | null
          export_format?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          source_doc_ids?: string[] | null
          version?: number
          model_used?: string
          sections?: Json
          user_annotations?: Json
          risk_flags?: string[]
          deal_breaker_fired?: boolean
          investment_thesis?: string | null
          open_questions?: string[] | null
          suggested_next_step?: string | null
          generated_at?: string
          exported_at?: string | null
          export_format?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_memos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
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
