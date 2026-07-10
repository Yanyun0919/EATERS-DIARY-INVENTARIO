import { useState, type FormEvent } from 'react'
import { supplierFormSchema, type SupplierFormValues } from '@/features/suppliers/schemas/supplier'
import { Button } from '@/shared/components/Button'

interface SupplierFormProps {
  initialValues: SupplierFormValues
  onSubmit: (values: SupplierFormValues) => Promise<void>
  submitLabel: string
  readOnly: boolean
}

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50'

const fields: Array<{ key: keyof SupplierFormValues; label: string; required?: boolean }> = [
  { key: 'name', label: 'Name', required: true },
  { key: 'contactName', label: 'Contact name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'paymentTerms', label: 'Payment terms' },
  { key: 'nifCif', label: 'NIF/CIF' },
]

export function SupplierForm({ initialValues, onSubmit, submitLabel, readOnly }: SupplierFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return

    const result = supplierFormSchema.safeParse(values)
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
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <label htmlFor={field.key} className="text-sm font-medium">
            {field.label}
          </label>
          <input
            id={field.key}
            value={values[field.key]}
            onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
            disabled={readOnly}
            className={inputClasses}
          />
          {errors[field.key] && <p className="text-sm text-red-600">{errors[field.key]}</p>}
        </div>
      ))}

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {!readOnly && (
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
