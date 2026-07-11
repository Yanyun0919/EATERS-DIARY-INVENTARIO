import type { StockCountStatus } from '@/core/supabase/database.types'

export const statusLabels: Record<StockCountStatus, string> = {
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export const statusClasses: Record<StockCountStatus, string> = {
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-neutral-200 text-neutral-600',
}

export function formatStockCountDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-ES')
}
