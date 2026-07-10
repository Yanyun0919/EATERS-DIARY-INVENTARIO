import { useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'
import { assignAccountToStore, removeAccountFromStore } from '@/features/stores/api/storeAccounts'

type StaffStore = Database['public']['Tables']['staff_stores']['Row']
type StaffProfile = Pick<Database['public']['Tables']['staff_profiles']['Row'], 'id' | 'full_name' | 'role'>

interface StoreAccountsEditorProps {
  storeId: string
  assignments: StaffStore[]
  assignedProfiles: StaffProfile[]
  unassignedProfiles: StaffProfile[]
  canWrite: boolean
  onChanged: () => void
}

export function StoreAccountsEditor({
  storeId,
  assignments,
  assignedProfiles,
  unassignedProfiles,
  canWrite,
  onChanged,
}: StoreAccountsEditorProps) {
  const [adding, setAdding] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profilesById = new Map(assignedProfiles.map((profile) => [profile.id, profile]))

  function startAdd() {
    setAdding(true)
    setSelectedProfileId('')
    setError(null)
  }

  function cancelAdd() {
    setAdding(false)
    setSelectedProfileId('')
    setError(null)
  }

  async function handleAssign() {
    if (!selectedProfileId) {
      setError('Select a login account')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await assignAccountToStore(storeId, selectedProfileId)
      cancelAdd()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(assignmentId: string) {
    setSubmitting(true)
    setError(null)
    try {
      await removeAccountFromStore(assignmentId)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Login Accounts</h2>
        {canWrite && !adding && (
          <Button variant="secondary" onClick={startAdd} className="px-2 py-1 text-xs">
            Assign account
          </Button>
        )}
      </div>

      {assignments.length === 0 && !adding && (
        <p className="text-sm text-neutral-500">No login account assigned to this store yet.</p>
      )}

      <ul className="space-y-1">
        {assignments.map((assignment) => (
          <li
            key={assignment.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
          >
            <span>{profilesById.get(assignment.staff_profile_id)?.full_name ?? 'Unknown account'}</span>
            {canWrite && (
              <button
                type="button"
                onClick={() => handleRemove(assignment.id)}
                disabled={submitting}
                className="text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="flex items-center gap-2 rounded-md border border-border p-3">
          <select
            value={selectedProfileId}
            onChange={(event) => setSelectedProfileId(event.target.value)}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
          >
            <option value="">Select an account…</option>
            {unassignedProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name}
              </option>
            ))}
          </select>
          <Button onClick={handleAssign} disabled={submitting} className="px-2 py-1 text-xs">
            Assign
          </Button>
          <Button variant="secondary" onClick={cancelAdd} disabled={submitting} className="px-2 py-1 text-xs">
            Cancel
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
