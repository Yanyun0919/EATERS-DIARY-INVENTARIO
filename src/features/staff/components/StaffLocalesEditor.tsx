import { useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { setStaffLocales } from '@/features/stores/api/storeAccounts'

type Store = Database['public']['Tables']['stores']['Row']

interface StaffLocalesEditorProps {
  staffProfileId: string
  stores: Store[]
  assignedStoreIds: string[]
  canWrite: boolean
  onChanged: () => void
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  if (err instanceof Error) return err.message
  return String(err)
}

// Immediate save per toggle, same interaction shape as StoreRolesEditor -- each change recomputes
// the employee's full desired Locale set and hands it to setStaffLocales, which diffs internally.
export function StaffLocalesEditor({
  staffProfileId,
  stores,
  assignedStoreIds,
  canWrite,
  onChanged,
}: StaffLocalesEditorProps) {
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assignedSet = new Set(assignedStoreIds)

  async function handleToggle(storeId: string, checked: boolean) {
    if (!canWrite || submittingId) return
    const nextStoreIds = checked ? [...assignedStoreIds, storeId] : assignedStoreIds.filter((id) => id !== storeId)

    setSubmittingId(storeId)
    setError(null)
    try {
      await setStaffLocales(staffProfileId, nextStoreIds)
      onChanged()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('setStaffLocales failed:', err)
      const detail = extractErrorMessage(err)
      setError(import.meta.env.DEV ? `Algo salió mal: ${detail}` : 'Algo salió mal')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Locales</h2>

      {stores.length === 0 && <p className="text-sm text-neutral-500">No hay locales activos.</p>}

      <div className="space-y-1">
        {stores.map((store) => (
          <label key={store.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={assignedSet.has(store.id)}
              onChange={(event) => handleToggle(store.id, event.target.checked)}
              disabled={!canWrite || submittingId === store.id}
            />
            {store.name}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
