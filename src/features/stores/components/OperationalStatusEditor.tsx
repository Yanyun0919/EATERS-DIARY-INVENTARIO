import { useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { updatePermissionEnabled } from '@/features/stores/api/storePermissions'

type StorePermission = Database['public']['Tables']['store_permissions']['Row']
type PermissionDefinition = Database['public']['Tables']['permission_definitions']['Row']

interface OperationalStatusEditorProps {
  storeId: string
  permissions: StorePermission[]
  definitions: PermissionDefinition[]
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

export function OperationalStatusEditor({
  storeId,
  permissions,
  definitions,
  canWrite,
  onChanged,
}: OperationalStatusEditorProps) {
  const [submittingKey, setSubmittingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const nameByKey = new Map(definitions.map((definition) => [definition.key, definition.name]))

  async function handleToggle(permissionKey: string, isEnabled: boolean) {
    if (!canWrite) return
    setSubmittingKey(permissionKey)
    setError(null)
    try {
      await updatePermissionEnabled(storeId, permissionKey, isEnabled)
      onChanged()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('updatePermissionEnabled failed:', err)
      const detail = extractErrorMessage(err)
      setError(import.meta.env.DEV ? `Algo salió mal: ${detail}` : 'Algo salió mal')
    } finally {
      setSubmittingKey(null)
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Estado de las Capacidades</h2>

      {permissions.length === 0 && (
        <p className="text-sm text-neutral-500">Este local no tiene capacidades que activar o desactivar.</p>
      )}

      <ul className="space-y-1">
        {permissions.map((permission) => (
          <li key={permission.permission_key} className="flex items-center justify-between text-sm">
            <span>{nameByKey.get(permission.permission_key) ?? permission.permission_key}</span>
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              {permission.is_enabled ? 'Activa' : 'Inactiva'}
              <input
                type="checkbox"
                checked={permission.is_enabled}
                onChange={(event) => handleToggle(permission.permission_key, event.target.checked)}
                disabled={!canWrite || submittingKey === permission.permission_key}
              />
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
