import { useEffect, useRef, useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { upsertStockCountItem } from '@/features/inventory/api/stockCounts'

type Product = Database['public']['Tables']['products']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface StockCountItemRowProps {
  stockCountId: string
  product: Product
  unit: Unit | undefined
  initialValue: string | null
  readOnly: boolean
  onSaved: (productId: string) => void
}

// No manual Save button — each field autosaves on its own shortly after the employee stops
// typing (BUSINESS_RULES.md section 3 / the "Stock Count Progress" requirement). Never reads or
// displays expected_quantity/variance — this component only ever knows about counted_quantity.
export function StockCountItemRow({ stockCountId, product, unit, initialValue, readOnly, onSaved }: StockCountItemRowProps) {
  const [value, setValue] = useState(initialValue ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debouncedValue = useDebouncedValue(value, 600)
  const lastSavedRef = useRef(initialValue ?? '')

  useEffect(() => {
    if (readOnly) return
    if (debouncedValue === lastSavedRef.current) return
    if (debouncedValue.trim() === '') return

    const parsed = Number(debouncedValue)
    if (Number.isNaN(parsed) || parsed < 0) return

    let cancelled = false
    setStatus('saving')
    upsertStockCountItem(stockCountId, product.id, parsed)
      .then(() => {
        if (cancelled) return
        lastSavedRef.current = debouncedValue
        setStatus('saved')
        onSaved(product.id)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [debouncedValue, readOnly, stockCountId, product.id, onSaved])

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 last:border-0">
      <span className="text-sm">{product.name}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={readOnly}
          className="w-24 rounded-md border border-border bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <span className="w-8 text-xs text-neutral-500">{unit?.abbreviation ?? ''}</span>
        <span className="w-16 text-xs">
          {status === 'saving' && <span className="text-neutral-400">Guardando…</span>}
          {status === 'saved' && <span className="text-green-600">Guardado</span>}
          {status === 'error' && <span className="text-red-600">Error</span>}
        </span>
      </div>
    </div>
  )
}
