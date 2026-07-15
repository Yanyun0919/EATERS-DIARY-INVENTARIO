import type { PurchaseUnitType } from '@/core/supabase/database.types'

export function formatPurchaseUnit(unit: PurchaseUnitType, spec: string | null) {
  return unit === 'other' ? (spec ?? 'otro') : unit
}

export function formatMoney(value: number) {
  return `${value.toFixed(2)} €`
}

export function formatPurchaseNumber(purchaseNumber: number) {
  return `PO-${String(purchaseNumber).padStart(6, '0')}`
}

export function formatPurchaseDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES')
}
