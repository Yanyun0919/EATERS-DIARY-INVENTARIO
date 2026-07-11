import { useState } from 'react'
import { createBrand } from '@/features/stores/api/brands'
import { Button } from '@/shared/components/Button'
import type { Database } from '@/core/supabase/database.types'

type Brand = Database['public']['Tables']['brands']['Row']

interface BrandDialogProps {
  onClose: () => void
  onCreated: (brand: Brand) => void
}

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

// Reached only from the Store form's Brand selector -- Brand has no standalone page. Name only,
// always active; no code/NIF/description/order, matching the minimal Brand model.
export function BrandDialog({ onClose, onCreated }: BrandDialogProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('El nombre es obligatorio')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const created = await createBrand({ name: trimmed, isActive: true })
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la marca')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-bg p-4 shadow-lg">
        <h2 className="mb-3 text-sm font-semibold">Nueva Marca</h2>

        <div className="space-y-1">
          <label htmlFor="newBrandName" className="text-sm font-medium">
            Nombre *
          </label>
          <input
            id="newBrandName"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClasses}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={handleSave} disabled={submitting} className="px-3 py-1.5 text-xs">
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
