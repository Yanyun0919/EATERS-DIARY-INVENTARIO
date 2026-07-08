import { useState, type FormEvent } from 'react'
import { productFormSchema, type ProductFormValues } from '@/features/products/schemas/product'
import { Button } from '@/shared/components/Button'
import type { Database } from '@/core/supabase/database.types'

type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface ProductFormProps {
  initialValues: ProductFormValues
  categories: Category[]
  units: Unit[]
  onSubmit: (values: ProductFormValues) => Promise<void>
  submitLabel: string
  readOnly: boolean
}

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50'

export function ProductForm({ initialValues, categories, units, onSubmit, submitLabel, readOnly }: ProductFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return

    const result = productFormSchema.safeParse(values)
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
        <label htmlFor="sku" className="text-sm font-medium">
          SKU
        </label>
        <input
          id="sku"
          value={values.sku}
          onChange={(event) => setValues({ ...values, sku: event.target.value })}
          disabled={readOnly}
          className={inputClasses}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="category" className="text-sm font-medium">
          Category
        </label>
        <select
          id="category"
          value={values.categoryId}
          onChange={(event) => setValues({ ...values, categoryId: event.target.value })}
          disabled={readOnly}
          className={inputClasses}
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="baseUnit" className="text-sm font-medium">
          Base unit
        </label>
        <select
          id="baseUnit"
          value={values.baseUnitId}
          onChange={(event) => setValues({ ...values, baseUnitId: event.target.value })}
          disabled={readOnly}
          className={inputClasses}
        >
          <option value="">Select a unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({unit.abbreviation})
            </option>
          ))}
        </select>
        {errors.baseUnitId && <p className="text-sm text-red-600">{errors.baseUnitId}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isStockTracked}
          onChange={(event) => setValues({ ...values, isStockTracked: event.target.checked })}
          disabled={readOnly}
        />
        Track inventory for this product
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
