import { useState, type FormEvent } from 'react'
import { storeFormSchema, type StoreFormValues } from '@/features/stores/schemas/store'
import { useBrands } from '@/features/stores/hooks/useBrands'
import { BrandDialog } from '@/features/stores/components/BrandDialog'
import { Button } from '@/shared/components/Button'

interface StoreFormProps {
  initialValues: StoreFormValues
  onSubmit: (values: StoreFormValues) => Promise<void>
  submitLabel: string
  readOnly: boolean
}

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50'

export function StoreForm({ initialValues, onSubmit, submitLabel, readOnly }: StoreFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false)

  const { data: brands, refetch: refetchBrands } = useBrands(true)

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
      setFormError(err instanceof Error ? err.message : 'Algo salió mal')
    } finally {
      setSubmitting(false)
    }
  }

  function handleBrandCreated(brand: { id: string; name: string }) {
    setValues((prev) => ({ ...prev, brandId: brand.id }))
    refetchBrands()
    setIsBrandDialogOpen(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Nombre
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
            Código
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
          <label htmlFor="brand" className="text-sm font-medium">
            Marca
          </label>
          <div className="flex items-center gap-2">
            <select
              id="brand"
              value={values.brandId}
              onChange={(event) => setValues({ ...values, brandId: event.target.value })}
              disabled={readOnly}
              className={inputClasses}
            >
              <option value="">Selecciona una marca</option>
              {(brands ?? []).map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setIsBrandDialogOpen(true)}
                className="whitespace-nowrap text-sm text-accent hover:underline"
              >
                + Nueva Marca
              </button>
            )}
          </div>
          {errors.brandId && <p className="text-sm text-red-600">{errors.brandId}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="address" className="text-sm font-medium">
            Dirección (opcional)
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
          Activo
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        {!readOnly && (
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : submitLabel}
          </Button>
        )}
      </form>

      {isBrandDialogOpen && (
        <BrandDialog onClose={() => setIsBrandDialogOpen(false)} onCreated={handleBrandCreated} />
      )}
    </>
  )
}
