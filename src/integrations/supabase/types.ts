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
      account_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          from_account_id: string
          id: string
          notes: string | null
          to_account_id: string
          txn_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          from_account_id: string
          id?: string
          notes?: string | null
          to_account_id: string
          txn_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          from_account_id?: string
          id?: string
          notes?: string | null
          to_account_id?: string
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          bank: Database["public"]["Enums"]["bank_type"]
          color: string
          created_at: string
          current_balance: number
          id: string
          is_active: boolean
          name: string
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank?: Database["public"]["Enums"]["bank_type"]
          color?: string
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank?: Database["public"]["Enums"]["bank_type"]
          color?: string
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      cash_receivables: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          party_name: string
          settled_amount: number
          status: Database["public"]["Enums"]["receivable_status"]
          txn_date: string
          type: Database["public"]["Enums"]["receivable_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          party_name: string
          settled_amount?: number
          status?: Database["public"]["Enums"]["receivable_status"]
          txn_date?: string
          type: Database["public"]["Enums"]["receivable_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          party_name?: string
          settled_amount?: number
          status?: Database["public"]["Enums"]["receivable_status"]
          txn_date?: string
          type?: Database["public"]["Enums"]["receivable_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_accounts: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          data: Json | null
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string
          icon: string
          id: string
          is_active: boolean
          is_personal: boolean
          name: string
        }
        Insert: {
          color?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_personal?: boolean
          name: string
        }
        Update: {
          color?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_personal?: boolean
          name?: string
        }
        Relationships: []
      }
      expense_transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_path: string | null
          branch_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          txn_date: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_path?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          txn_date?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_path?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_records: {
        Row: {
          created_at: string
          data: Json | null
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Relationships: []
      }
      income_categories: {
        Row: {
          color: string
          icon: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      income_transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_path: string | null
          branch_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          txn_date: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_path?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          txn_date?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_path?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          data: Json | null
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          created_at: string
          data: Json | null
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Relationships: []
      }
      monthly_balances: {
        Row: {
          account_id: string
          closing_balance: number | null
          created_at: string
          created_by: string | null
          id: string
          month: number
          opening_balance: number
          year: number
        }
        Insert: {
          account_id: string
          closing_balance?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          opening_balance?: number
          year: number
        }
        Update: {
          account_id?: string
          closing_balance?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          opening_balance?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          data: Json | null
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Relationships: []
      }
      salaries: {
        Row: {
          created_at: string
          data: Json | null
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
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
      recompute_account_balance: {
        Args: { _account_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "accountant"
        | "branch_manager"
        | "viewer"
        | "staff"
      bank_type:
        | "hdfc"
        | "kvb"
        | "canara"
        | "sbi"
        | "icici"
        | "axis"
        | "other"
        | "cash"
      payment_mode: "cash" | "gpay" | "bank_transfer"
      receivable_status: "pending" | "settled" | "partial"
      receivable_type:
        | "cash_received"
        | "cash_returned"
        | "gpay_received"
        | "gpay_returned"
        | "transfer_received"
        | "transfer_returned"
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
      app_role: [
        "super_admin",
        "accountant",
        "branch_manager",
        "viewer",
        "staff",
      ],
      bank_type: [
        "hdfc",
        "kvb",
        "canara",
        "sbi",
        "icici",
        "axis",
        "other",
        "cash",
      ],
      payment_mode: ["cash", "gpay", "bank_transfer"],
      receivable_status: ["pending", "settled", "partial"],
      receivable_type: [
        "cash_received",
        "cash_returned",
        "gpay_received",
        "gpay_returned",
        "transfer_received",
        "transfer_returned",
      ],
    },
  },
} as const
