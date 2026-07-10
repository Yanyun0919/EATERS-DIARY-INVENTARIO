import { useState, type FormEvent } from 'react'
import { storeFormSchema, type StoreFormValues } from '@/features/stores/schemas/store'
import { Button } from '@/shared/components/Button'
import type { Database } from '@/core/supabase/database.types'

type Brand = Database['public']['Tables']['brands']['Row']

interface StoreFormProps {
  initialValues: StoreFormValues
  brands: Brand[]
  onSubmit: (values: StoreFormValues) => Promise<void>
  submitLabel: string
  readOnly: boolean
}

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50'

export function StoreForm({ initialValues, brands, onSubmit, submitLabel, readOnly }: StoreFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return

    const result = storeFormSchema.safeParse(values)
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
          Store Name
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
        <label htmlFor="code" className="text-sm font-medium">
          Store Code
        </label>
        <input
          id="code"
          value={values.code}
          onChange={(event) => setValues({ ...values, code: event.target.value })}
          disabled={readOnly}
          className={inputClasses}
        />
        {errors.code && <p className="text-sm text-red-600">{errors.code}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="type" className="text-sm font-medium">
          Store Type
        </label>
        <select
          id="type"
          value={values.type}
          onChange={(event) => setValues({ ...values, type: event.target.value as StoreFormValues['type'] })}
          disabled={readOnly}
          className={inputClasses}
        >
          <option value="retail_store">Retail Store</option>
          <option value="production_center">Production Center</option>
        </select>
        {errors.type && <p className="text-sm text-red-600">{errors.type}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="brand" className="text-sm font-medium">
          Brand
        </label>
        <select
          id="brand"
          value={values.brandId}
          onChange={(event) => setValues({ ...values, brandId: event.target.value })}
          disabled={readOnly}
          className={inputClasses}
        >
          <option value="">Select a brand</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        {errors.brandId && <p className="text-sm text-red-600">{errors.brandId}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="address" className="text-sm font-medium">
          Address (optional)
        </label>
        <input
          id="address"
          value={values.address}
          onChange={(event) => setValues({ ...values, address: event.target.value })}
          disabled={readOnly}
          className={inputClasses}
        />
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
