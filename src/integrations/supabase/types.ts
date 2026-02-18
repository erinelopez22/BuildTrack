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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      borrow_transactions: {
        Row: {
          asset_id: string
          borrowed_at: string
          borrowed_by: string
          borrowed_qty: number
          created_at: string
          expected_return_date: string | null
          id: string
          project_id: string
          return_remarks: string | null
          returned_at: string | null
          returned_qty: number
          status: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          borrowed_at?: string
          borrowed_by: string
          borrowed_qty: number
          created_at?: string
          expected_return_date?: string | null
          id?: string
          project_id: string
          return_remarks?: string | null
          returned_at?: string | null
          returned_qty?: number
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          borrowed_at?: string
          borrowed_by?: string
          borrowed_qty?: number
          created_at?: string
          expected_return_date?: string | null
          id?: string
          project_id?: string
          return_remarks?: string | null
          returned_at?: string | null
          returned_qty?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrow_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "company_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_assets: {
        Row: {
          asset_code: string | null
          asset_name: string
          asset_type: string
          condition: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          total_quantity: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          asset_code?: string | null
          asset_name: string
          asset_type?: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          total_quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          asset_code?: string | null
          asset_name?: string
          asset_type?: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          total_quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          carrier: string | null
          created_at: string | null
          delivery_date: string | null
          delivery_number: string
          id: string
          notes: string | null
          order_id: string
          received_by: string | null
          received_date: string | null
          tracking_number: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          delivery_date?: string | null
          delivery_number: string
          id?: string
          notes?: string | null
          order_id: string
          received_by?: string | null
          received_date?: string | null
          tracking_number?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          delivery_date?: string | null
          delivery_number?: string
          id?: string
          notes?: string | null
          order_id?: string
          received_by?: string | null
          received_date?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          condition: string | null
          created_at: string | null
          delivery_id: string
          id: string
          notes: string | null
          order_item_id: string
          quantity_received: number
        }
        Insert: {
          condition?: string | null
          created_at?: string | null
          delivery_id: string
          id?: string
          notes?: string | null
          order_item_id: string
          quantity_received: number
        }
        Update: {
          condition?: string | null
          created_at?: string | null
          delivery_id?: string
          id?: string
          notes?: string | null
          order_item_id?: string
          quantity_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          notes: string | null
          project_id: string
          quantity: number
          quantity_after: number
          quantity_before: number
          reference_id: string | null
          reference_type: string | null
          sku_id: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          transfer_project_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          notes?: string | null
          project_id: string
          quantity: number
          quantity_after: number
          quantity_before: number
          reference_id?: string | null
          reference_type?: string | null
          sku_id: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          transfer_project_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          quantity_after?: number
          quantity_before?: number
          reference_id?: string | null
          reference_type?: string | null
          sku_id?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          transfer_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_transfer_project_id_fkey"
            columns: ["transfer_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
          quantity_ordered: number
          quantity_received: number | null
          quotation_item_id: string | null
          sku_id: string
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          quantity_ordered: number
          quantity_received?: number | null
          quotation_item_id?: string | null
          sku_id: string
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          quantity_ordered?: number
          quantity_received?: number | null
          quotation_item_id?: string | null
          sku_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: false
            referencedRelation: "quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_assignments: {
        Row: {
          arrived_at: string | null
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_remarks: string | null
          driver_user_id: string
          held_at: string | null
          hold_remarks: string | null
          id: string
          order_id: string
          plate_number: string
          resume_remarks: string | null
          resumed_at: string | null
          tracking_status: string
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivery_remarks?: string | null
          driver_user_id: string
          held_at?: string | null
          hold_remarks?: string | null
          id?: string
          order_id: string
          plate_number: string
          resume_remarks?: string | null
          resumed_at?: string | null
          tracking_status?: string
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_remarks?: string | null
          driver_user_id?: string
          held_at?: string | null
          hold_remarks?: string | null
          id?: string
          order_id?: string
          plate_number?: string
          resume_remarks?: string | null
          resumed_at?: string | null
          tracking_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_evidence: {
        Row: {
          file_name: string
          file_url: string
          id: string
          order_tracking_assignment_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          order_tracking_assignment_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          order_tracking_assignment_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_evidence_order_tracking_assignment_id_fkey"
            columns: ["order_tracking_assignment_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_number: string
          order_type: string | null
          previous_status: string | null
          project_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          supplier_contact: string | null
          supplier_name: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          order_type?: string | null
          previous_status?: string | null
          project_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          supplier_contact?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          order_type?: string | null
          previous_status?: string | null
          project_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          supplier_contact?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          notification_preferences: Json | null
          phone: string | null
          sms_opt_in: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          sms_opt_in?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          sms_opt_in?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      project_inventory: {
        Row: {
          created_at: string | null
          id: string
          location_in_site: string | null
          min_threshold: number | null
          on_hand: number | null
          project_id: string
          reserved: number | null
          sku_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_in_site?: string | null
          min_threshold?: number | null
          on_hand?: number | null
          project_id: string
          reserved?: number | null
          sku_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_in_site?: string | null
          min_threshold?: number | null
          on_hand?: number | null
          project_id?: string
          reserved?: number | null
          sku_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inventory_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_quotations: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          estimated_cost: number | null
          id: string
          location: string | null
          name: string
          project_manager_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          id?: string
          location?: string | null
          name: string
          project_manager_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          id?: string
          location?: string | null
          name?: string
          project_manager_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quotation_change_requests: {
        Row: {
          change_type: string
          created_at: string
          id: string
          payload: Json
          project_id: string
          quotation_id: string | null
          requested_by: string
          review_remarks: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          change_type: string
          created_at?: string
          id?: string
          payload?: Json
          project_id: string
          quotation_id?: string | null
          requested_by: string
          review_remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string
          quotation_id?: string | null
          requested_by?: string
          review_remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_change_requests_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "project_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          id: string
          material_name: string
          quantity: number
          quotation_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          quantity?: number
          quotation_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          quantity?: number
          quotation_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "project_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      receiver_evidence: {
        Row: {
          file_name: string
          file_url: string
          id: string
          order_tracking_assignment_id: string
          remarks: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          order_tracking_assignment_id: string
          remarks?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          order_tracking_assignment_id?: string
          remarks?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiver_evidence_order_tracking_assignment_id_fkey"
            columns: ["order_tracking_assignment_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      skus: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          default_min_threshold: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sku_code: string
          specifications: Json | null
          unit_of_measure: string
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_min_threshold?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sku_code: string
          specifications?: Json | null
          unit_of_measure?: string
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_min_threshold?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sku_code?: string
          specifications?: Json | null
          unit_of_measure?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          message: string
          phone_number: string
          provider_message_id: string | null
          recipient_user_id: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          message: string
          phone_number: string
          provider_message_id?: string | null
          recipient_user_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          message?: string
          phone_number?: string
          provider_message_id?: string | null
          recipient_user_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
        }
        Relationships: []
      }
      sms_settings: {
        Row: {
          created_at: string | null
          event_rules: Json | null
          id: string
          is_enabled: boolean | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_sender_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_rules?: Json | null
          id?: string
          is_enabled?: boolean | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_sender_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_rules?: Json | null
          id?: string
          is_enabled?: boolean | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_sender_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      Test: {
        Row: {
          address: string | null
          created_at: string
          id: number
          name: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: number
          name?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      tracking_driver_materials: {
        Row: {
          assigned_quantity: number
          created_at: string
          id: string
          order_item_id: string
          tracking_assignment_id: string
        }
        Insert: {
          assigned_quantity: number
          created_at?: string
          id?: string
          order_item_id: string
          tracking_assignment_id: string
        }
        Update: {
          assigned_quantity?: number
          created_at?: string
          id?: string
          order_item_id?: string
          tracking_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_driver_materials_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_driver_materials_tracking_assignment_id_fkey"
            columns: ["tracking_assignment_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
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
      can_approve_orders: { Args: { _user_id: string }; Returns: boolean }
      can_create_orders: { Args: { _user_id: string }; Returns: boolean }
      can_manage_roles: { Args: { _user_id: string }; Returns: boolean }
      can_process_logistics: { Args: { _user_id: string }; Returns: boolean }
      can_receive_orders: { Args: { _user_id: string }; Returns: boolean }
      can_submit_orders: { Args: { _user_id: string }; Returns: boolean }
      can_transition_order_status: {
        Args: {
          _from_status: Database["public"]["Enums"]["order_status"]
          _to_status: Database["public"]["Enums"]["order_status"]
          _user_id: string
        }
        Returns: boolean
      }
      get_project_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_approver: { Args: { _user_id: string }; Returns: boolean }
      is_office_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_warehouse_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "project_manager"
        | "procurement"
        | "storekeeper"
        | "site_lead"
        | "viewer"
        | "approver"
        | "approval_admin"
        | "logistics_admin"
        | "project_engineer"
        | "receiver"
        | "tracking_driver"
        | "office_admin"
        | "warehouse_admin"
      order_status:
        | "draft"
        | "for_approval"
        | "approved"
        | "ordered"
        | "in_transit"
        | "delivered"
        | "partially_received"
        | "fully_received"
        | "closed"
        | "cancelled"
        | "rejected"
        | "submitted"
        | "preparing"
        | "on_hold"
      project_status:
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
        | "deleted"
      transaction_type:
        | "stock_in"
        | "stock_out"
        | "transfer_in"
        | "transfer_out"
        | "adjustment"
        | "receiving"
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
        "admin",
        "project_manager",
        "procurement",
        "storekeeper",
        "site_lead",
        "viewer",
        "approver",
        "approval_admin",
        "logistics_admin",
        "project_engineer",
        "receiver",
        "tracking_driver",
        "office_admin",
        "warehouse_admin",
      ],
      order_status: [
        "draft",
        "for_approval",
        "approved",
        "ordered",
        "in_transit",
        "delivered",
        "partially_received",
        "fully_received",
        "closed",
        "cancelled",
        "rejected",
        "submitted",
        "preparing",
        "on_hold",
      ],
      project_status: [
        "active",
        "on_hold",
        "completed",
        "cancelled",
        "deleted",
      ],
      transaction_type: [
        "stock_in",
        "stock_out",
        "transfer_in",
        "transfer_out",
        "adjustment",
        "receiving",
      ],
    },
  },
} as const
