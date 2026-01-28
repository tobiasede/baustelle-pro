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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bauleiter_kolonne_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          kolonne_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          kolonne_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          kolonne_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bauleiter_kolonne_assignments_kolonne_id_fkey"
            columns: ["kolonne_id"]
            isOneToOne: false
            referencedRelation: "kolonnen"
            referencedColumns: ["id"]
          },
        ]
      }
      kolonne_lv_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          is_active: boolean | null
          kolonne_id: string
          lv_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          kolonne_id: string
          lv_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          kolonne_id?: string
          lv_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kolonne_lv_assignments_kolonne_id_fkey"
            columns: ["kolonne_id"]
            isOneToOne: false
            referencedRelation: "kolonnen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kolonne_lv_assignments_lv_id_fkey"
            columns: ["lv_id"]
            isOneToOne: false
            referencedRelation: "lvs"
            referencedColumns: ["id"]
          },
        ]
      }
      kolonnen: {
        Row: {
          created_at: string | null
          id: string
          number: string
          project: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          number: string
          project?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          number?: string
          project?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      leistungsmeldung_items: {
        Row: {
          created_at: string | null
          id: string
          leistungsmeldung_tag_id: string
          lv_item_id: string
          qty_actual: number | null
          qty_plan: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          leistungsmeldung_tag_id: string
          lv_item_id: string
          qty_actual?: number | null
          qty_plan?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          leistungsmeldung_tag_id?: string
          lv_item_id?: string
          qty_actual?: number | null
          qty_plan?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leistungsmeldung_items_leistungsmeldung_tag_id_fkey"
            columns: ["leistungsmeldung_tag_id"]
            isOneToOne: false
            referencedRelation: "leistungsmeldung_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leistungsmeldung_items_lv_item_id_fkey"
            columns: ["lv_item_id"]
            isOneToOne: false
            referencedRelation: "lv_items"
            referencedColumns: ["id"]
          },
        ]
      }
      leistungsmeldung_tags: {
        Row: {
          actual_revenue: number | null
          created_at: string | null
          date: string
          employees_count: number
          foreman_id: string
          hours_per_employee: number
          id: string
          kolonne_id: string
          planned_revenue: number | null
          rev_per_employee: number | null
          rev_per_hour: number | null
          updated_at: string | null
        }
        Insert: {
          actual_revenue?: number | null
          created_at?: string | null
          date: string
          employees_count: number
          foreman_id: string
          hours_per_employee: number
          id?: string
          kolonne_id: string
          planned_revenue?: number | null
          rev_per_employee?: number | null
          rev_per_hour?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_revenue?: number | null
          created_at?: string | null
          date?: string
          employees_count?: number
          foreman_id?: string
          hours_per_employee?: number
          id?: string
          kolonne_id?: string
          planned_revenue?: number | null
          rev_per_employee?: number | null
          rev_per_hour?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leistungsmeldung_tags_kolonne_id_fkey"
            columns: ["kolonne_id"]
            isOneToOne: false
            referencedRelation: "kolonnen"
            referencedColumns: ["id"]
          },
        ]
      }
      lv_items: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          lv_id: string
          position_code: string
          short_text: string
          unit: string
          unit_price: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          lv_id: string
          position_code: string
          short_text: string
          unit: string
          unit_price: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          lv_id?: string
          position_code?: string
          short_text?: string
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "lv_items_lv_id_fkey"
            columns: ["lv_id"]
            isOneToOne: false
            referencedRelation: "lvs"
            referencedColumns: ["id"]
          },
        ]
      }
      lvs: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          project: string | null
          updated_at: string | null
          upload_file_id: string | null
          valid_from: string | null
          valid_to: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          project?: string | null
          updated_at?: string | null
          upload_file_id?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          project?: string | null
          updated_at?: string | null
          upload_file_id?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      can_access_kolonne: {
        Args: { _kolonne_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_bauleiter_for_kolonne: {
        Args: { _kolonne_id: string; _user_id: string }
        Returns: boolean
      }
      is_host_or_gf: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "HOST" | "GF" | "BAULEITER"
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
      app_role: ["HOST", "GF", "BAULEITER"],
    },
  },
} as const
