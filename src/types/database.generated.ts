export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          attachment_url: string;
          content: string;
          created_at: string;
          id: string;
          published: boolean;
          title: string;
        };
        Insert: {
          attachment_url?: string;
          content?: string;
          created_at?: string;
          id?: string;
          published?: boolean;
          title: string;
        };
        Update: {
          attachment_url?: string;
          content?: string;
          created_at?: string;
          id?: string;
          published?: boolean;
          title?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      application_document_versions: {
        Row: {
          application_id: string;
          document_type: string;
          file_name: string;
          id: string;
          storage_path: string;
          uploaded_at: string;
        };
        Insert: {
          application_id: string;
          document_type: string;
          file_name: string;
          id?: string;
          storage_path: string;
          uploaded_at?: string;
        };
        Update: {
          application_id?: string;
          document_type?: string;
          file_name?: string;
          id?: string;
          storage_path?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_document_versions_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_documents: {
        Row: {
          application_id: string;
          document_type: string;
          file_name: string;
          id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at: string;
        };
        Insert: {
          application_id: string;
          document_type: string;
          file_name: string;
          id?: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at?: string;
        };
        Update: {
          application_id?: string;
          document_type?: string;
          file_name?: string;
          id?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_education: {
        Row: {
          application_id: string;
          degree: string;
          gpa: number | null;
          graduation_year: number | null;
          id: string;
          institution: string;
          major: string;
        };
        Insert: {
          application_id: string;
          degree: string;
          gpa?: number | null;
          graduation_year?: number | null;
          id?: string;
          institution: string;
          major: string;
        };
        Update: {
          application_id?: string;
          degree?: string;
          gpa?: number | null;
          graduation_year?: number | null;
          id?: string;
          institution?: string;
          major?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_education_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_experience: {
        Row: {
          application_id: string;
          details: string;
          employer: string;
          end_date: string | null;
          id: string;
          position: string;
          start_date: string | null;
        };
        Insert: {
          application_id: string;
          details?: string;
          employer: string;
          end_date?: string | null;
          id?: string;
          position: string;
          start_date?: string | null;
        };
        Update: {
          application_id?: string;
          details?: string;
          employer?: string;
          end_date?: string | null;
          id?: string;
          position?: string;
          start_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "application_experience_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_status_history: {
        Row: {
          actor_id: string | null;
          application_id: string;
          created_at: string;
          from_status: Database["public"]["Enums"]["application_state"] | null;
          id: number;
          message: string;
          to_status: Database["public"]["Enums"]["application_state"];
        };
        Insert: {
          actor_id?: string | null;
          application_id: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["application_state"] | null;
          id?: never;
          message?: string;
          to_status: Database["public"]["Enums"]["application_state"];
        };
        Update: {
          actor_id?: string | null;
          application_id?: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["application_state"] | null;
          id?: never;
          message?: string;
          to_status?: Database["public"]["Enums"]["application_state"];
        };
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          application_number: string | null;
          consent_at: string | null;
          consent_version: string | null;
          correction_deadline: string | null;
          created_at: string;
          id: string;
          job_id: string;
          payment_status: Database["public"]["Enums"]["payment_state"];
          personal_data: Json;
          public_message: string;
          snapshot: Json | null;
          status: Database["public"]["Enums"]["application_state"];
          submitted_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_number?: string | null;
          consent_at?: string | null;
          consent_version?: string | null;
          correction_deadline?: string | null;
          created_at?: string;
          id?: string;
          job_id: string;
          payment_status?: Database["public"]["Enums"]["payment_state"];
          personal_data?: Json;
          public_message?: string;
          snapshot?: Json | null;
          status?: Database["public"]["Enums"]["application_state"];
          submitted_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          application_number?: string | null;
          consent_at?: string | null;
          consent_version?: string | null;
          correction_deadline?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string;
          payment_status?: Database["public"]["Enums"]["payment_state"];
          personal_data?: Json;
          public_message?: string;
          snapshot?: Json | null;
          status?: Database["public"]["Enums"]["application_state"];
          submitted_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_positions";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          archived: boolean;
          id: string;
          name: string;
        };
        Insert: {
          archived?: boolean;
          id?: string;
          name: string;
        };
        Update: {
          archived?: boolean;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      email_outbox: {
        Row: {
          attempts: number;
          body: string;
          created_at: string;
          dedup_key: string;
          error_code: string | null;
          id: string;
          lease_token: string | null;
          lease_until: string | null;
          next_attempt_at: string;
          sent_at: string | null;
          status: string;
          subject: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          body: string;
          created_at?: string;
          dedup_key: string;
          error_code?: string | null;
          id?: string;
          lease_token?: string | null;
          lease_until?: string | null;
          next_attempt_at?: string;
          sent_at?: string | null;
          status?: string;
          subject: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          body?: string;
          created_at?: string;
          dedup_key?: string;
          error_code?: string | null;
          id?: string;
          lease_token?: string | null;
          lease_until?: string | null;
          next_attempt_at?: string;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      exam_assignments: {
        Row: {
          application_id: string;
          exam_number: string;
          id: string;
          schedule_id: string;
        };
        Insert: {
          application_id: string;
          exam_number: string;
          id?: string;
          schedule_id: string;
        };
        Update: {
          application_id?: string;
          exam_number?: string;
          id?: string;
          schedule_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_assignments_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_assignments_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "exam_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_schedules: {
        Row: {
          exam_at: string;
          id: string;
          instructions: string;
          job_id: string;
          published: boolean;
          title: string;
          venue: string;
        };
        Insert: {
          exam_at: string;
          id?: string;
          instructions?: string;
          job_id: string;
          published?: boolean;
          title: string;
          venue: string;
        };
        Update: {
          exam_at?: string;
          id?: string;
          instructions?: string;
          job_id?: string;
          published?: boolean;
          title?: string;
          venue?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_schedules_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_positions";
            referencedColumns: ["id"];
          },
        ];
      };
      job_positions: {
        Row: {
          announcement_url: string;
          archived: boolean;
          category: string;
          department_id: string;
          employment_type: string;
          fee_amount: number;
          id: string;
          max_file_mb: number;
          payment_instructions: string;
          published: boolean;
          qualifications: string;
          require_national_id: boolean;
          required_documents: Json;
          round_id: string;
          title: string;
          vacancies: number;
        };
        Insert: {
          announcement_url?: string;
          archived?: boolean;
          category: string;
          department_id: string;
          employment_type: string;
          fee_amount?: number;
          id?: string;
          max_file_mb?: number;
          payment_instructions?: string;
          published?: boolean;
          qualifications?: string;
          require_national_id?: boolean;
          required_documents?: Json;
          round_id: string;
          title: string;
          vacancies: number;
        };
        Update: {
          announcement_url?: string;
          archived?: boolean;
          category?: string;
          department_id?: string;
          employment_type?: string;
          fee_amount?: number;
          id?: string;
          max_file_mb?: number;
          payment_instructions?: string;
          published?: boolean;
          qualifications?: string;
          require_national_id?: boolean;
          required_documents?: Json;
          round_id?: string;
          title?: string;
          vacancies?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_positions_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_positions_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "recruitment_rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          application_id: string | null;
          created_at: string;
          id: string;
          message: string;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_records: {
        Row: {
          amount: number;
          application_id: string;
          created_at: string;
          document_id: string;
          id: string;
          paid_at: string;
          reason: string;
          reference: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          slip_path: string;
          status: Database["public"]["Enums"]["payment_state"];
        };
        Insert: {
          amount: number;
          application_id: string;
          created_at?: string;
          document_id: string;
          id?: string;
          paid_at: string;
          reason?: string;
          reference?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          slip_path: string;
          status?: Database["public"]["Enums"]["payment_state"];
        };
        Update: {
          amount?: number;
          application_id?: string;
          created_at?: string;
          document_id?: string;
          id?: string;
          paid_at?: string;
          reason?: string;
          reference?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          slip_path?: string;
          status?: Database["public"]["Enums"]["payment_state"];
        };
        Relationships: [
          {
            foreignKeyName: "payment_records_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_records_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "application_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          consent_at: string | null;
          consent_version: string;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          phone: string;
          prefix: string;
          updated_at: string;
        };
        Insert: {
          consent_at?: string | null;
          consent_version?: string;
          created_at?: string;
          first_name?: string;
          id: string;
          last_name?: string;
          phone?: string;
          prefix?: string;
          updated_at?: string;
        };
        Update: {
          consent_at?: string | null;
          consent_version?: string;
          created_at?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          phone?: string;
          prefix?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      published_results: {
        Row: {
          approved_by: string;
          id: string;
          job_id: string;
          kind: string;
          published_at: string;
          rows: Json;
          title: string;
        };
        Insert: {
          approved_by: string;
          id?: string;
          job_id: string;
          kind: string;
          published_at?: string;
          rows?: Json;
          title: string;
        };
        Update: {
          approved_by?: string;
          id?: string;
          job_id?: string;
          kind?: string;
          published_at?: string;
          rows?: Json;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "published_results_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_positions";
            referencedColumns: ["id"];
          },
        ];
      };
      recruitment_rounds: {
        Row: {
          archived: boolean;
          closes_at: string;
          id: string;
          max_per_user: number;
          name: string;
          opens_at: string;
          published: boolean;
          year_be: number;
        };
        Insert: {
          archived?: boolean;
          closes_at: string;
          id?: string;
          max_per_user?: number;
          name: string;
          opens_at: string;
          published?: boolean;
          year_be: number;
        };
        Update: {
          archived?: boolean;
          closes_at?: string;
          id?: string;
          max_per_user?: number;
          name?: string;
          opens_at?: string;
          published?: boolean;
          year_be?: number;
        };
        Relationships: [];
      };
      selection_results: {
        Row: {
          application_id: string;
          id: string;
          outcome: string;
          published: boolean;
          remark: string;
          score: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          application_id: string;
          id?: string;
          outcome: string;
          published?: boolean;
          remark?: string;
          score?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          application_id?: string;
          id?: string;
          outcome?: string;
          published?: boolean;
          remark?: string;
          score?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "selection_results_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: true;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_notes: {
        Row: {
          application_id: string;
          author_id: string;
          created_at: string;
          id: string;
          note: string;
        };
        Insert: {
          application_id: string;
          author_id: string;
          created_at?: string;
          id?: string;
          note: string;
        };
        Update: {
          application_id?: string;
          author_id?: string;
          created_at?: string;
          id?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_notes_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_by: string | null;
          permissions: string[];
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          granted_by?: string | null;
          permissions?: string[];
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          granted_by?: string | null;
          permissions?: string[];
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_save: { Args: { p_data: Json; p_table: string }; Returns: string };
      check_upload: { Args: { p_id: string; p_type: string }; Returns: Json };
      claim_emails: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          body: string;
          email: string;
          id: string;
          lease_token: string;
          subject: string;
        }[];
      };
      claim_rate: {
        Args: { p_key: string; p_limit: number; p_scope: string };
        Returns: boolean;
      };
      complete_upload: {
        Args: {
          p_id: string;
          p_mime: string;
          p_name: string;
          p_path: string;
          p_size: number;
          p_type: string;
          p_user: string;
        };
        Returns: Json;
      };
      finish_email: {
        Args: { p_code?: string; p_id: string; p_lease: string; p_ok: boolean };
        Returns: undefined;
      };
      list_accounts: { Args: { p_search?: string }; Returns: Json };
      publish_results: {
        Args: { p_job: string; p_kind: string; p_title: string };
        Returns: string;
      };
      review_application: {
        Args: {
          p_deadline?: string;
          p_id: string;
          p_message?: string;
          p_status: Database["public"]["Enums"]["application_state"];
        };
        Returns: undefined;
      };
      review_payment: {
        Args: { p_confirm: boolean; p_id: string; p_reason?: string };
        Returns: undefined;
      };
      save_application: {
        Args: {
          p_education: Json;
          p_experience: Json;
          p_id: string;
          p_job: string;
          p_personal: Json;
        };
        Returns: string;
      };
      save_payment: {
        Args: {
          p_amount: number;
          p_app: string;
          p_paid: string;
          p_reference?: string;
        };
        Returns: string;
      };
      save_setting: {
        Args: { p_key: string; p_value: Json };
        Returns: undefined;
      };
      set_role: {
        Args: {
          p_permissions?: string[];
          p_role: Database["public"]["Enums"]["app_role"];
          p_user: string;
        };
        Returns: undefined;
      };
      staff_dashboard: { Args: { p_filters?: Json }; Returns: Json };
      staff_list: {
        Args: {
          p_filters?: Json;
          p_page?: number;
          p_size?: number;
          p_sort?: string;
        };
        Returns: Json;
      };
      submit_application: {
        Args: { p_consent: string; p_id: string };
        Returns: string;
      };
    };
    Enums: {
      app_role: "applicant" | "hr" | "admin";
      application_state:
        | "draft"
        | "submitted"
        | "under_review"
        | "needs_correction"
        | "eligible"
        | "ineligible"
        | "withdrawn";
      payment_state:
        | "not_required"
        | "awaiting_payment"
        | "pending"
        | "confirmed"
        | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["applicant", "hr", "admin"],
      application_state: [
        "draft",
        "submitted",
        "under_review",
        "needs_correction",
        "eligible",
        "ineligible",
        "withdrawn",
      ],
      payment_state: [
        "not_required",
        "awaiting_payment",
        "pending",
        "confirmed",
        "rejected",
      ],
    },
  },
} as const;
