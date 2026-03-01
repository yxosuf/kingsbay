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
          cancel_reason: string | null
          cancelled_at: string | null
          check_in: string
          check_out: string
          checked_in_at: string | null
          checked_out_at: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          created_by: string | null
          external_booking_id: string | null
          external_room_type_id: string | null
          external_source: string | null
          guest_id: string
          hold_expires_at: string | null
          id: string
          imported_via: string | null
          needs_review: boolean | null
          no_show_at: string | null
          num_guests: number | null
          ota_price: number | null
          ota_reference: string | null
          parent_booking_id: string | null
          property_id: string | null
          raw_email_id: string | null
          review_reason: string | null
          room_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          booking_source?: Database["public"]["Enums"]["booking_source"]
          cancel_reason?: string | null
          cancelled_at?: string | null
          check_in: string
          check_out: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          external_booking_id?: string | null
          external_room_type_id?: string | null
          external_source?: string | null
          guest_id: string
          hold_expires_at?: string | null
          id?: string
          imported_via?: string | null
          needs_review?: boolean | null
          no_show_at?: string | null
          num_guests?: number | null
          ota_price?: number | null
          ota_reference?: string | null
          parent_booking_id?: string | null
          property_id?: string | null
          raw_email_id?: string | null
          review_reason?: string | null
          room_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          booking_source?: Database["public"]["Enums"]["booking_source"]
          cancel_reason?: string | null
          cancelled_at?: string | null
          check_in?: string
          check_out?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          external_booking_id?: string | null
          external_room_type_id?: string | null
          external_source?: string | null
          guest_id?: string
          hold_expires_at?: string | null
          id?: string
          imported_via?: string | null
          needs_review?: boolean | null
          no_show_at?: string | null
          num_guests?: number | null
          ota_price?: number | null
          ota_reference?: string | null
          parent_booking_id?: string | null
          property_id?: string | null
          raw_email_id?: string | null
          review_reason?: string | null
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
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
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
      channel_connections: {
        Row: {
          api_key: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          commission_rate: number | null
          created_at: string
          ical_export_url: string | null
          ical_import_url: string | null
          id: string
          is_enabled: boolean
          last_error_message: string | null
          last_sync_at: string | null
          property_id: string
          sync_status: Database["public"]["Enums"]["sync_status"]
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          commission_rate?: number | null
          created_at?: string
          ical_export_url?: string | null
          ical_import_url?: string | null
          id?: string
          is_enabled?: boolean
          last_error_message?: string | null
          last_sync_at?: string | null
          property_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          commission_rate?: number | null
          created_at?: string
          ical_export_url?: string | null
          ical_import_url?: string | null
          id?: string
          is_enabled?: boolean
          last_error_message?: string | null
          last_sync_at?: string | null
          property_id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_connections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_room_mappings: {
        Row: {
          channel_connection_id: string
          created_at: string
          external_room_name: string
          external_room_type_id: string | null
          id: string
          internal_room_id: string | null
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          channel_connection_id: string
          created_at?: string
          external_room_name: string
          external_room_type_id?: string | null
          id?: string
          internal_room_id?: string | null
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          channel_connection_id?: string
          created_at?: string
          external_room_name?: string
          external_room_type_id?: string | null
          id?: string
          internal_room_id?: string | null
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_room_mappings_channel_connection_id_fkey"
            columns: ["channel_connection_id"]
            isOneToOne: false
            referencedRelation: "channel_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_room_mappings_internal_room_id_fkey"
            columns: ["internal_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingest_logs: {
        Row: {
          created_at: string
          extracted: Json | null
          from_email: string | null
          id: string
          message_id: string | null
          parse_error: string | null
          parse_status: string
          property_id: string | null
          provider: string
          raw_text: string | null
          received_at: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          extracted?: Json | null
          from_email?: string | null
          id?: string
          message_id?: string | null
          parse_error?: string | null
          parse_status?: string
          property_id?: string | null
          provider: string
          raw_text?: string | null
          received_at?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          extracted?: Json | null
          from_email?: string | null
          id?: string
          message_id?: string | null
          parse_error?: string | null
          parse_status?: string
          property_id?: string | null
          provider?: string
          raw_text?: string | null
          received_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_ingest_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      guest_view_logs: {
        Row: {
          guest_id: string
          id: string
          property_id: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          guest_id: string
          id?: string
          property_id?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          guest_id?: string
          id?: string
          property_id?: string | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_view_logs_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_view_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          blacklist_reason: string | null
          country: string | null
          created_at: string
          email: string | null
          guest_type: Database["public"]["Enums"]["guest_type"]
          id: string
          id_passport: string | null
          is_blacklisted: boolean
          is_vip: boolean
          name: string
          nationality: string | null
          nic_number: string | null
          notes: string | null
          passport_number: string | null
          passport_photo_path: string | null
          passport_photo_uploaded_at: string | null
          phone: string | null
          property_id: string | null
          total_spent: number
          total_stays: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          blacklist_reason?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          guest_type?: Database["public"]["Enums"]["guest_type"]
          id?: string
          id_passport?: string | null
          is_blacklisted?: boolean
          is_vip?: boolean
          name: string
          nationality?: string | null
          nic_number?: string | null
          notes?: string | null
          passport_number?: string | null
          passport_photo_path?: string | null
          passport_photo_uploaded_at?: string | null
          phone?: string | null
          property_id?: string | null
          total_spent?: number
          total_stays?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          blacklist_reason?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          guest_type?: Database["public"]["Enums"]["guest_type"]
          id?: string
          id_passport?: string | null
          is_blacklisted?: boolean
          is_vip?: boolean
          name?: string
          nationality?: string | null
          nic_number?: string | null
          notes?: string | null
          passport_number?: string | null
          passport_photo_path?: string | null
          passport_photo_uploaded_at?: string | null
          phone?: string | null
          property_id?: string | null
          total_spent?: number
          total_stays?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          property_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          property_id?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          property_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_property_id_fkey"
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
      property_inventory_settings: {
        Row: {
          auto_close_at: number
          created_at: string
          hold_timeout_hours: number
          id: string
          property_id: string
          safety_buffer: number
          sync_frequency: Database["public"]["Enums"]["sync_frequency"]
          updated_at: string
        }
        Insert: {
          auto_close_at?: number
          created_at?: string
          hold_timeout_hours?: number
          id?: string
          property_id: string
          safety_buffer?: number
          sync_frequency?: Database["public"]["Enums"]["sync_frequency"]
          updated_at?: string
        }
        Update: {
          auto_close_at?: number
          created_at?: string
          hold_timeout_hours?: number
          id?: string
          property_id?: string
          safety_buffer?: number
          sync_frequency?: Database["public"]["Enums"]["sync_frequency"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_inventory_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      room_availability: {
        Row: {
          blocked_reason: string | null
          booking_id: string | null
          created_at: string
          date: string
          id: string
          is_available: boolean
          room_id: string
          source_channel: Database["public"]["Enums"]["channel_type"] | null
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          booking_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_available?: boolean
          room_id: string
          source_channel?: Database["public"]["Enums"]["channel_type"] | null
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          booking_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_available?: boolean
          room_id?: string
          source_channel?: Database["public"]["Enums"]["channel_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_availability_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_availability_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          amenities: string[] | null
          created_at: string
          description: string | null
          floor: number | null
          housekeeping_status: Database["public"]["Enums"]["housekeeping_status"]
          id: string
          last_checkout_at: string | null
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
          housekeeping_status?: Database["public"]["Enums"]["housekeeping_status"]
          id?: string
          last_checkout_at?: string | null
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
          housekeeping_status?: Database["public"]["Enums"]["housekeeping_status"]
          id?: string
          last_checkout_at?: string | null
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
      sync_logs: {
        Row: {
          channel_id: string
          created_at: string
          direction: Database["public"]["Enums"]["sync_direction"]
          error_message: string | null
          id: string
          records_synced: number
          status: Database["public"]["Enums"]["sync_result_status"]
        }
        Insert: {
          channel_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["sync_direction"]
          error_message?: string | null
          id?: string
          records_synced?: number
          status: Database["public"]["Enums"]["sync_result_status"]
        }
        Update: {
          channel_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["sync_direction"]
          error_message?: string | null
          id?: string
          records_synced?: number
          status?: Database["public"]["Enums"]["sync_result_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_connections"
            referencedColumns: ["id"]
          },
        ]
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
      check_booking_overlap: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_exclude_booking_id?: string
          p_room_id: string
        }
        Returns: {
          conflicting_booking_id: string
          conflicting_check_in: string
          conflicting_check_out: string
          conflicting_guest_name: string
          has_overlap: boolean
        }[]
      }
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
        | "no_show"
        | "needs_review"
      channel_type:
        | "direct"
        | "booking_com"
        | "airbnb"
        | "agoda"
        | "expedia"
        | "other_ota"
      guest_type: "local" | "international"
      housekeeping_status: "clean" | "dirty" | "cleaning"
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
      sync_direction: "inbound" | "outbound"
      sync_frequency: "realtime" | "5min" | "15min" | "hourly"
      sync_result_status: "success" | "failed" | "partial"
      sync_status: "active" | "error" | "disabled"
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
        "no_show",
        "needs_review",
      ],
      channel_type: [
        "direct",
        "booking_com",
        "airbnb",
        "agoda",
        "expedia",
        "other_ota",
      ],
      guest_type: ["local", "international"],
      housekeeping_status: ["clean", "dirty", "cleaning"],
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
      sync_direction: ["inbound", "outbound"],
      sync_frequency: ["realtime", "5min", "15min", "hourly"],
      sync_result_status: ["success", "failed", "partial"],
      sync_status: ["active", "error", "disabled"],
    },
  },
} as const
