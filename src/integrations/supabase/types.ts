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
      bookings: {
        Row: {
          booking_source: Database["public"]["Enums"]["booking_source"]
          check_in: string
          check_out: string
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          created_by: string | null
          guest_id: string
          id: string
          num_guests: number | null
          ota_price: number | null
          ota_reference: string | null
          property_id: string | null
          room_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          booking_source?: Database["public"]["Enums"]["booking_source"]
          check_in: string
          check_out: string
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          guest_id: string
          id?: string
          num_guests?: number | null
          ota_price?: number | null
          ota_reference?: string | null
          property_id?: string | null
          room_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          booking_source?: Database["public"]["Enums"]["booking_source"]
          check_in?: string
          check_out?: string
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          guest_id?: string
          id?: string
          num_guests?: number | null
          ota_price?: number | null
          ota_reference?: string | null
          property_id?: string | null
          room_id?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_services: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          property_id: string | null
          quantity: number
          service_date: string
          service_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          quantity?: number
          service_date?: string
          service_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          quantity?: number
          service_date?: string
          service_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          id_passport: string | null
          name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          id_passport?: string | null
          name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          id_passport?: string | null
          name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          property_id: string | null
          room_charges: number
          service_charges: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_id?: string | null
          room_charges?: number
          service_charges?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_id?: string | null
          room_charges?: number
          service_charges?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          property_id: string | null
          received_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          property_id?: string | null
          received_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          property_id?: string | null
          received_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          phone: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          total_rooms: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          phone?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          total_rooms?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          phone?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          total_rooms?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          amenities: string[] | null
          created_at: string
          description: string | null
          floor: number | null
          id: string
          max_guests: number | null
          price: number
          property_id: string | null
          room_number: string
          room_type: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          created_at?: string
          description?: string | null
          floor?: number | null
          id?: string
          max_guests?: number | null
          price?: number
          property_id?: string | null
          room_number: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          created_at?: string
          description?: string | null
          floor?: number | null
          id?: string
          max_guests?: number | null
          price?: number
          property_id?: string | null
          room_number?: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_property_access: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_property_access_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["staff_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_front_desk: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      booking_source:
        | "direct"
        | "booking_com"
        | "airbnb"
        | "agoda"
        | "expedia"
        | "other_ota"
      booking_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "archived"
      payment_method: "cash" | "card" | "bank_transfer" | "online"
      payment_status: "pending" | "partial" | "paid"
      property_type: "hotel" | "villa" | "resort" | "apartment" | "guesthouse"
      room_status: "available" | "occupied" | "reserved" | "maintenance"
      service_category:
        | "room_service"
        | "transport"
        | "facilities"
        | "special_request"
      staff_role: "admin" | "front_desk" | "manager"
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
      booking_source: [
        "direct",
        "booking_com",
        "airbnb",
        "agoda",
        "expedia",
        "other_ota",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "archived",
      ],
      payment_method: ["cash", "card", "bank_transfer", "online"],
      payment_status: ["pending", "partial", "paid"],
      property_type: ["hotel", "villa", "resort", "apartment", "guesthouse"],
      room_status: ["available", "occupied", "reserved", "maintenance"],
      service_category: [
        "room_service",
        "transport",
        "facilities",
        "special_request",
      ],
      staff_role: ["admin", "front_desk", "manager"],
    },
  },
} as const
