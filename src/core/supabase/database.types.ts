// Hand-written to match supabase/migrations/001_initial_schema.sql + 002_master_data_rls_policies.sql.
// Only covers tables the Products (Master Data) feature depends on today; extend as other
// features land rather than typing the whole schema up front.
//
// Postgres `numeric` columns are serialized as strings by PostgREST on read (to avoid float
// precision loss), so Row types use `string` for them while Insert/Update accept `number`.
//
// `Relationships: []` and the `Views`/`Functions` keys below aren't optional — supabase-js's
// generic client requires every table to satisfy `GenericTable` and the schema to satisfy
// `GenericSchema` (see @supabase/postgrest-js/src/types/common/common.ts). Omitting them
// silently falls back to `never` for every Row/Insert/Update type instead of erroring loudly.

export type StaffRole = 'admin' | 'manager' | 'staff'
export type UnitType = 'weight' | 'volume' | 'count'
export type ProductAliasType = 'translation' | 'supplier_name' | 'barcode'

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
          parent_category_id: string | null
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
          sku: string | null
          category_id: string | null
          base_unit_id: string
          is_active: boolean
          is_stock_tracked: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['products']['Row']> & {
          name: string
          base_unit_id: string
        }
        Update: Partial<Database['public']['Tables']['products']['Row']>
        Relationships: []
      }
      product_unit_conversions: {
        Row: {
          id: string
          product_id: string
          from_unit_id: string
          to_unit_id: string
          factor: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          from_unit_id: string
          to_unit_id: string
          factor: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['product_unit_conversions']['Insert']>
        Relationships: []
      }
      product_aliases: {
        Row: {
          id: string
          product_id: string
          alias: string
          alias_type: ProductAliasType
          language_code: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          alias: string
          alias_type: ProductAliasType
          language_code?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['product_aliases']['Insert']>
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
          purchase_unit_id: string
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
          purchase_unit_id: string
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
