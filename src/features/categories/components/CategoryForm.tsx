import { useState, type FormEvent } from 'react'
import { categoryFormSchema, type CategoryFormValues } from '@/features/categories/schemas/category'
import { Button } from '@/shared/components/Button'

interface CategoryFormProps {
  initialValues: CategoryFormValues
  onSubmit: (values: CategoryFormValues) => Promise<void>
  submitLabel: string
  readOnly: boolean
}

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50'

export function CategoryForm({ initialValues, onSubmit, submitLabel, readOnly }: CategoryFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return

    const result = categoryFormSchema.safeParse(values)
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
        <p className="text-xs text-neutral-500">Controls the order this category appears in dropdowns.</p>
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
