import { useState, type FormEvent } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'
import {
  unitConversionFormSchema,
  type UnitConversionFormValues,
} from '@/features/products/schemas/product'
import {
  upsertUnitConversion,
  deleteUnitConversion,
  type UnitConversionInput,
} from '@/features/products/api/productRelations'

type Unit = Database['public']['Tables']['units']['Row']
type Conversion = Database['public']['Tables']['product_unit_conversions']['Row']

interface UnitConversionsEditorProps {
  productId: string
  conversions: Conversion[]
  units: Unit[]
  canWrite: boolean
  onChanged: () => void
}

const emptyForm: UnitConversionFormValues = { fromUnitId: '', toUnitId: '', factor: 1 }
const inputClasses = 'rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent'

export function UnitConversionsEditor({ productId, conversions, units, canWrite, onChanged }: UnitConversionsEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UnitConversionFormValues>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const unitsById = new Map(units.map((unit) => [unit.id, unit]))

  function startAdd() {
    setEditingId('new')
    setForm(emptyForm)
    setError(null)
  }

  function startEdit(conversion: Conversion) {
    setEditingId(conversion.id)
    setForm({
      fromUnitId: conversion.from_unit_id,
      toUnitId: conversion.to_unit_id,
      factor: Number(conversion.factor),
    })
    setError(null)
  }

  function cancel() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = unitConversionFormSchema.safeParse(form)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid value')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const input: UnitConversionInput = {
        id: editingId !== 'new' ? (editingId ?? undefined) : undefined,
        productId,
        fromUnitId: result.data.fromUnitId,
        toUnitId: result.data.toUnitId,
        factor: result.data.factor,
      }
      await upsertUnitConversion(input)
      cancel()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteUnitConversion(id)
    onChanged()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Unit conversions</h2>
        {canWrite && editingId === null && (
          <Button variant="secondary" onClick={startAdd} className="px-2 py-1 text-xs">
            Add conversion
          </Button>
        )}
      </div>

      {conversions.length === 0 && editingId === null && (
        <p className="text-sm text-neutral-500">No conversions yet — this product only uses its base unit.</p>
      )}

      <ul className="space-y-1">
        {conversions.map((conversion) => (
          <li key={conversion.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>
              1 {unitsById.get(conversion.from_unit_id)?.abbreviation ?? '?'} = {conversion.factor}{' '}
              {unitsById.get(conversion.to_unit_id)?.abbreviation ?? '?'}
            </span>
            {canWrite && (
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(conversion)} className="text-accent hover:underline">
                  Edit
                </button>
                <button type="button" onClick={() => handleDelete(conversion.id)} className="text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">From unit</label>
            <select
              value={form.fromUnitId}
              onChange={(event) => setForm({ ...form, fromUnitId: event.target.value })}
              className={inputClasses}
            >
              <option value="">Select…</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.abbreviation}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Factor</label>
            <input
              type="number"
              step="any"
              value={form.factor}
              onChange={(event) => setForm({ ...form, factor: Number(event.target.value) })}
              className={`${inputClasses} w-24`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">To unit</label>
            <select
              value={form.toUnitId}
              onChange={(event) => setForm({ ...form, toUnitId: event.target.value })}
              className={inputClasses}
            >
              <option value="">Select…</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.abbreviation}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={submitting} className="px-2 py-1 text-xs">
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={cancel} className="px-2 py-1 text-xs">
            Cancel
          </Button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}
