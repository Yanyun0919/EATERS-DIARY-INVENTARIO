import { useState, type FormEvent } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'
import { aliasFormSchema, type AliasFormValues } from '@/features/products/schemas/product'
import { upsertAlias, deleteAlias, type AliasInput } from '@/features/products/api/productRelations'

type Alias = Database['public']['Tables']['product_aliases']['Row']

interface ProductAliasesEditorProps {
  productId: string
  aliases: Alias[]
  canWrite: boolean
  onChanged: () => void
}

const aliasTypeLabels: Record<Alias['alias_type'], string> = {
  translation: 'Translation',
  barcode: 'Barcode',
  supplier_name: 'Supplier name',
}

const emptyForm: AliasFormValues = { alias: '', aliasType: 'translation', languageCode: '' }
const inputClasses = 'rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent'

export function ProductAliasesEditor({ productId, aliases, canWrite, onChanged }: ProductAliasesEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AliasFormValues>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function startAdd() {
    setEditingId('new')
    setForm(emptyForm)
    setError(null)
  }

  function startEdit(alias: Alias) {
    setEditingId(alias.id)
    setForm({ alias: alias.alias, aliasType: alias.alias_type, languageCode: alias.language_code ?? '' })
    setError(null)
  }

  function cancel() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = aliasFormSchema.safeParse(form)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid value')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const input: AliasInput = {
        id: editingId !== 'new' ? (editingId ?? undefined) : undefined,
        productId,
        alias: result.data.alias,
        aliasType: result.data.aliasType,
        languageCode: result.data.languageCode || null,
      }
      await upsertAlias(input)
      cancel()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteAlias(id)
    onChanged()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Alternate names, barcodes &amp; translations</h2>
        {canWrite && editingId === null && (
          <Button variant="secondary" onClick={startAdd} className="px-2 py-1 text-xs">
            Add
          </Button>
        )}
      </div>

      {aliases.length === 0 && editingId === null && (
        <p className="text-sm text-neutral-500">No alternate names, barcodes, or translations yet.</p>
      )}

      <ul className="space-y-1">
        {aliases.map((alias) => (
          <li key={alias.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>
              <span className="text-neutral-500">
                {aliasTypeLabels[alias.alias_type]}
                {alias.language_code ? ` (${alias.language_code})` : ''}:
              </span>{' '}
              {alias.alias}
            </span>
            {canWrite && (
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(alias)} className="text-accent hover:underline">
                  Edit
                </button>
                <button type="button" onClick={() => handleDelete(alias.id)} className="text-red-600 hover:underline">
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
            <label className="text-xs font-medium">Type</label>
            <select
              value={form.aliasType}
              onChange={(event) => setForm({ ...form, aliasType: event.target.value as AliasFormValues['aliasType'] })}
              className={inputClasses}
            >
              <option value="translation">Translation</option>
              <option value="barcode">Barcode</option>
              <option value="supplier_name">Supplier name</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Value</label>
            <input
              value={form.alias}
              onChange={(event) => setForm({ ...form, alias: event.target.value })}
              className={inputClasses}
            />
          </div>
          {form.aliasType === 'translation' && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Language code</label>
              <input
                value={form.languageCode}
                onChange={(event) => setForm({ ...form, languageCode: event.target.value })}
                placeholder="es, en…"
                className={`${inputClasses} w-20`}
              />
            </div>
          )}
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
