import { useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { assignStoreRole, removeStoreRole } from '@/features/stores/api/storeRoles'

type StoreRoleDefinition = Database['public']['Tables']['store_role_definitions']['Row']
type PermissionDefinition = Database['public']['Tables']['permission_definitions']['Row']

interface StoreRolesEditorProps {
  storeId: string
  roleDefinitions: StoreRoleDefinition[]
  assignedRoleKeys: string[]
  permissionDefinitions: PermissionDefinition[]
  canWrite: boolean
  onChanged: () => void
}

// Mirrors derive_store_permission_keys() in supabase/migrations/019_store_roles.sql -- kept in
// sync manually since Postgres and the client can't share code. Only used to preview, before
// saving, which capabilities a Role removal would take away; the server-side trigger is always
// the actual source of truth.
const ROLE_DERIVED_KEYS: Record<string, string[]> = {
  retail_store: ['internal_supply_request'],
  production_center: ['internal_supply_fulfillment'],
}

function deriveCapabilityKeys(roleKeys: Set<string>): Set<string> {
  const keys = new Set<string>()
  for (const roleKey of roleKeys) {
    for (const permissionKey of ROLE_DERIVED_KEYS[roleKey] ?? []) {
      keys.add(permissionKey)
    }
  }
  if (roleKeys.size > 0) keys.add('stock_count')
  return keys
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export function StoreRolesEditor({
  storeId,
  roleDefinitions,
  assignedRoleKeys,
  permissionDefinitions,
  canWrite,
  onChanged,
}: StoreRolesEditorProps) {
  const [submittingKey, setSubmittingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assignedSet = new Set(assignedRoleKeys)
  const permissionNameByKey = new Map(permissionDefinitions.map((definition) => [definition.key, definition.name]))

  async function handleAdd(roleKey: string) {
    setSubmittingKey(roleKey)
    setError(null)
    try {
      await assignStoreRole(storeId, roleKey)
      onChanged()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('assignStoreRole failed:', err)
      const detail = extractErrorMessage(err)
      setError(import.meta.env.DEV ? `Algo salió mal: ${detail}` : 'Algo salió mal')
    } finally {
      setSubmittingKey(null)
    }
  }

  async function handleRemove(roleKey: string) {
    if (assignedSet.size <= 1) {
      setError('Un local debe tener al menos un rol.')
      return
    }

    const nextRoleKeys = new Set(assignedSet)
    nextRoleKeys.delete(roleKey)
    const lostKeys = [...deriveCapabilityKeys(assignedSet)].filter((key) => !deriveCapabilityKeys(nextRoleKeys).has(key))

    if (lostKeys.length > 0) {
      const lostNames = lostKeys.map((key) => permissionNameByKey.get(key) ?? key).join(', ')
      const confirmed = window.confirm(
        `Al quitar este rol se eliminarán estas capacidades: ${lostNames}. ¿Continuar?`,
      )
      if (!confirmed) return
    }

    setSubmittingKey(roleKey)
    setError(null)
    try {
      await removeStoreRole(storeId, roleKey)
      onChanged()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('removeStoreRole failed:', err)
      const detail = extractErrorMessage(err)
      setError(import.meta.env.DEV ? `Algo salió mal: ${detail}` : 'Algo salió mal')
    } finally {
      setSubmittingKey(null)
    }
  }

  function handleToggle(roleKey: string, checked: boolean) {
    if (!canWrite || submittingKey) return
    if (checked) {
      void handleAdd(roleKey)
    } else {
      void handleRemove(roleKey)
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Roles</h2>

      {roleDefinitions.length === 0 && <p className="text-sm text-neutral-500">No hay roles definidos.</p>}

      <div className="space-y-1">
        {roleDefinitions.map((definition) => (
          <label key={definition.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={assignedSet.has(definition.key)}
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
