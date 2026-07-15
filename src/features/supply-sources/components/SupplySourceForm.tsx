import { useState, type FormEvent } from 'react'
import { supplySourceFormSchema, type SupplySourceFormValues } from '@/features/supply-sources/schemas/supplySource'
import { Button } from '@/shared/components/Button'
import type { Database } from '@/core/supabase/database.types'

type Store = Database['public']['Tables']['stores']['Row']

interface SupplySourceFormProps {
  initialValues: SupplySourceFormValues
  productionCenterStores: Store[]
  onSubmit: (values: SupplySourceFormValues) => Promise<void>
  submitLabel: string
  readOnly: boolean
}

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50'

// resolutionType determines whether the Locale field applies at all (approved Technical
// Design: 'external' resolves through Product -> supplier_products, needs no configuration;
// 'internal' resolves to a Locale holding the production_center Store Role). Switching
// resolutionType away from 'internal' clears storeId, since a stale value would otherwise
// silently resubmit a Locale for a source type that no longer uses one.
export function SupplySourceForm({
  initialValues,
  productionCenterStores,
  onSubmit,
  submitLabel,
  readOnly,
}: SupplySourceFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function handleResolutionTypeChange(resolutionType: SupplySourceFormValues['resolutionType']) {
    setValues({ ...values, resolutionType, storeId: resolutionType === 'internal' ? values.storeId : null })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return

    const result = supplySourceFormSchema.safeParse(values)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit(result.data)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          disabled={readOnly}
          className={inputClasses}
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="resolutionType" className="text-sm font-medium">
          Type
        </label>
        <select
          id="resolutionType"
          value={values.resolutionType}
          onChange={(event) => handleResolutionTypeChange(event.target.value as SupplySourceFormValues['resolutionType'])}
          disabled={readOnly}
          className={inputClasses}
        >
          <option value="external">External</option>
          <option value="internal">Internal</option>
        </select>
      </div>

      {values.resolutionType === 'internal' && (
        <div className="space-y-1">
          <label htmlFor="storeId" className="text-sm font-medium">
            Locale
          </label>
          <select
            id="storeId"
            value={values.storeId ?? ''}
            onChange={(event) => setValues({ ...values, storeId: event.target.value || null })}
            disabled={readOnly}
            className={inputClasses}
          >
            <option value="">Select a Locale</option>
            {productionCenterStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          {errors.storeId && <p className="text-sm text-red-600">{errors.storeId}</p>}
          {productionCenterStores.length === 0 && (
            <p className="text-xs text-neutral-500">
              No Locale currently holds the Central Kitchen (Production Center) role.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="sortOrder" className="text-sm font-medium">
          Order
        </label>
        <input
          id="sortOrder"
          type="number"
          step="1"
          value={values.sortOrder}
          onChange={(event) => setValues({ ...values, sortOrder: Number(event.target.value) })}
          disabled={readOnly}
          className={inputClasses}
        />
        {errors.sortOrder && <p className="text-sm text-red-600">{errors.sortOrder}</p>}
        <p className="text-xs text-neutral-500">Controls the order this Supply Source appears in dropdowns.</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(event) => setValues({ ...values, isActive: event.target.checked })}
          disabled={readOnly}
        />
        Active
      </label>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {!readOnly && (
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
