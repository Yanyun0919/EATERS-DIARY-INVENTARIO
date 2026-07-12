import type { Database } from '@/core/supabase/database.types'

type StorePermission = Database['public']['Tables']['store_permissions']['Row']
type PermissionDefinition = Database['public']['Tables']['permission_definitions']['Row']

interface DerivedCapabilitiesListProps {
  permissions: StorePermission[]
  definitions: PermissionDefinition[]
}

// Read-only -- these rows are only ever written by the sync_store_permissions_from_roles
// trigger (migration 019), driven by the Roles section above. Nothing here is editable; the
// toggle for these same rows lives in the separate Operational Status section.
export function DerivedCapabilitiesList({ permissions, definitions }: DerivedCapabilitiesListProps) {
  const nameByKey = new Map(definitions.map((definition) => [definition.key, definition.name]))

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Capacidades Derivadas</h2>

      {permissions.length === 0 ? (
        <p className="text-sm text-neutral-500">Este local no tiene capacidades derivadas todavía.</p>
      ) : (
        <ul className="space-y-1">
          {permissions.map((permission) => (
            <li key={permission.permission_key} className="text-sm text-neutral-700">
              {nameByKey.get(permission.permission_key) ?? permission.permission_key}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
