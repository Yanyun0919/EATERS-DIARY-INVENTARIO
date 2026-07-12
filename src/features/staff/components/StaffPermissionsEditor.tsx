import { useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { grantStaffPermission, revokeStaffPermission } from '@/features/staff/api/staffPermissions'

type StaffPermissionDefinition = Database['public']['Tables']['staff_permission_definitions']['Row']

interface StaffPermissionsEditorProps {
  staffProfileId: string
  definitions: StaffPermissionDefinition[]
  grantedKeys: string[]
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

// Grant = row exists, revoke = row removed -- no minimum-one requirement (unlike Store Roles),
// no derived-capability warning -- Staff Permissions don't drive anything else.
export function StaffPermissionsEditor({
  staffProfileId,
  definitions,
  grantedKeys,
  canWrite,
  onChanged,
}: StaffPermissionsEditorProps) {
  const [submittingKey, setSubmittingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const grantedSet = new Set(grantedKeys)

  async function handleToggle(key: string, checked: boolean) {
    if (!canWrite || submittingKey) return
    setSubmittingKey(key)
    setError(null)
    try {
      if (checked) {
        await grantStaffPermission(staffProfileId, key)
      } else {
        await revokeStaffPermission(staffProfileId, key)
      }
      onChanged()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('staff permission toggle failed:', err)
      const detail = extractErrorMessage(err)
      setError(import.meta.env.DEV ? `Algo salió mal: ${detail}` : 'Algo salió mal')
    } finally {
      setSubmittingKey(null)
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Permisos</h2>

      {definitions.length === 0 && <p className="text-sm text-neutral-500">No hay permisos definidos.</p>}

      <div className="space-y-1">
        {definitions.map((definition) => (
          <label key={definition.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={grantedSet.has(definition.key)}
              onChange={(event) => handleToggle(definition.key, event.target.checked)}
              disabled={!canWrite || submittingKey === definition.key}
            />
            {definition.name}
            {definition.description && <span className="text-xs text-neutral-500">— {definition.description}</span>}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
