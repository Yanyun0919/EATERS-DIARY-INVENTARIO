// Hand-written to match supabase/migrations/001-014 (see supabase/migrations/). Only covers
// tables the Products, Suppliers, Stores, Categories, and Inventory features depend on today;
// extend as other features land rather than typing the whole schema up front.
//
// Postgres `numeric` columns are serialized as strings by PostgREST on read (to avoid float
// precision loss), so Row types use `string` for them while Insert/Update accept `number`.
//
// `Relationships: []` and the `Views`/`Functions` keys below aren't optional — supabase-js's
// generic client requires every table to satisfy `GenericTable` and the schema to satisfy
// `GenericSchema` (see @supabase/postgrest-js/src/types/common/common.ts). Omitting them
// silently falls back to `never` for every Row/Insert/Update type instead of erroring loudly.

// Final V1 RBAC role model (migration 011) — replaced the earlier admin/manager/staff model.
export type StaffRole = 'administrator' | 'purchasing' | 'retail_store' | 'production_center'
export type UnitType = 'weight' | 'volume' | 'count'
export type PurchaseUnitType = 'kg' | 'g' | 'L' | 'ml' | 'other'
export type StoreType = 'production_center' | 'retail_store'
export type StockCountStatus = 'in_progress' | 'completed' | 'cancelled'

export interface Database {
  public: {
    Tables: {
      staff_profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string
          role: StaffRole
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['staff_profiles']['Row']> & {
          user_id: string
          full_name: string
        }
        Update: Partial<Database['public']['Tables']['staff_profiles']['Row']>
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & { name: string }
        Update: Partial<Database['public']['Tables']['categories']['Row']>
        Relationships: []
      }
      units: {
        Row: {
          id: string
          name: string
          abbreviation: string
          type: UnitType
        }
        Insert: Partial<Database['public']['Tables']['units']['Row']> & {
          name: string
          abbreviation: string
          type: UnitType
        }
        Update: Partial<Database['public']['Tables']['units']['Row']>
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          category_id: string
          base_unit_id: string
          minimum_stock: string
          is_active: boolean
          is_stock_tracked: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['products']['Row'], 'minimum_stock'>> & {
          name: string
          category_id: string
          base_unit_id: string
          minimum_stock?: number
        }
        Update: Partial<Omit<Database['public']['Tables']['products']['Row'], 'minimum_stock'>> & {
          minimum_stock?: number
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          name: string
          nif_cif: string | null
          contact_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          payment_terms: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['suppliers']['Row']> & { name: string }
        Update: Partial<Database['public']['Tables']['suppliers']['Row']>
        Relationships: []
      }
      supplier_products: {
        Row: {
          id: string
          supplier_id: string
          product_id: string
          supplier_sku: string | null
          unit_price: string
          purchase_unit: PurchaseUnitType
          purchase_unit_spec: string | null
          moq: string
          lead_time_days: number | null
          iva_rate: string
          is_preferred: boolean
          is_available: boolean
          price_updated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          product_id: string
          supplier_sku?: string | null
          unit_price: number
          purchase_unit: PurchaseUnitType
          purchase_unit_spec?: string | null
          moq?: number
          lead_time_days?: number | null
          iva_rate?: number
          is_preferred?: boolean
          is_available?: boolean
          price_updated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['supplier_products']['Insert']>
        Relationships: []
      }
      brands: {
        Row: {
          id: string
          name: string
          code: string | null
          nif_cif: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['brands']['Row']> & { name: string }
        Update: Partial<Database['public']['Tables']['brands']['Row']>
        Relationships: []
      }
      stores: {
        Row: {
          id: string
          brand_id: string
          name: string
          code: string
          address: string | null
          type: StoreType
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['stores']['Row']> & {
          brand_id: string
          name: string
          code: string
          type: StoreType
        }
        Update: Partial<Database['public']['Tables']['stores']['Row']>
        Relationships: []
      }
      staff_stores: {
        Row: {
          id: string
          staff_profile_id: string
          store_id: string
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          staff_profile_id: string
          store_id: string
          is_primary?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['staff_stores']['Insert']>
        Relationships: []
      }
      permission_definitions: {
        Row: {
          key: string
          module: string
          name: string
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['permission_definitions']['Row']> & {
          key: string
          module: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['permission_definitions']['Row']>
        Relationships: []
      }
      store_permissions: {
        Row: {
          id: string
          store_id: string
          permission_key: string
          granted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          permission_key: string
          granted_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['store_permissions']['Insert']>
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          store_id: string
          product_id: string
          quantity_on_hand: string
          last_counted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['inventory']['Row'], 'quantity_on_hand'>> & {
          store_id: string
          product_id: string
          quantity_on_hand?: number
        }
        Update: Partial<Omit<Database['public']['Tables']['inventory']['Row'], 'quantity_on_hand'>> & {
          quantity_on_hand?: number
        }
        Relationships: []
      }
      stock_counts: {
        Row: {
          id: string
          store_id: string
          status: StockCountStatus
          counted_by: string | null
          started_at: string
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['stock_counts']['Row']> & { store_id: string }
        Update: Partial<Database['public']['Tables']['stock_counts']['Row']>
        Relationships: []
      }
      stock_count_items: {
        Row: {
          id: string
          stock_count_id: string
          product_id: string
          expected_quantity: string
          counted_quantity: string
          variance: string
          notes: string | null
          created_at: string
        }
        Insert: Partial<
          Omit<Database['public']['Tables']['stock_count_items']['Row'], 'expected_quantity' | 'counted_quantity' | 'variance'>
        > & {
          stock_count_id: string
          product_id: string
          counted_quantity: number
        }
        Update: Partial<
          Omit<Database['public']['Tables']['stock_count_items']['Row'], 'expected_quantity' | 'counted_quantity' | 'variance'>
        > & {
          counted_quantity?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      complete_stock_count: {
        Args: { target_count_id: string }
        Returns: void
      }
    }
  }
}
