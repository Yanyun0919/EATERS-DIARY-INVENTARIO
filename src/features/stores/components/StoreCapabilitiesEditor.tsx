import { useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'
import { syncStorePermissions } from '@/features/stores/api/storePermissions'

type PermissionDefinition = Database['public']['Tables']['permission_definitions']['Row']

interface StoreCapabilitiesEditorProps {
  storeId: string
  definitions: PermissionDefinition[]
  grantedKeys: string[]
  canWrite: boolean
  onChanged: () => void
}

function groupByModule(definitions: PermissionDefinition[]) {
  const groups = new Map<string, PermissionDefinition[]>()
  for (const definition of definitions) {
    const list = groups.get(definition.module) ?? []
    list.push(definition)
    groups.set(definition.module, list)
  }
  return groups
}

export function StoreCapabilitiesEditor({
  storeId,
  definitions,
  grantedKeys,
  canWrite,
  onChanged,
}: StoreCapabilitiesEditorProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(grantedKeys))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grantedSet = new Set(grantedKeys)
  const isDirty =
    selectedKeys.size !== grantedSet.size || [...selectedKeys].some((key) => !grantedSet.has(key))

  function toggleKey(key: string) {
    if (!canWrite) return
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function handleSave() {
    setSubmitting(true)
    setError(null)
    try {
      await syncStorePermissions(storeId, [...selectedKeys])
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    setSelectedKeys(new Set(grantedKeys))
    setError(null)
  }

  const groups = groupByModule(definitions)

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Operational Capabilities</h2>

      {definitions.length === 0 && <p className="text-sm text-neutral-500">No operational capabilities defined.</p>}

      <div className="space-y-4">
        {[...groups.entries()].map(([module, moduleDefinitions]) => (
          <div key={module} className="space-y-1">
            <h3 className="text-xs font-semibold uppercase text-neutral-500">{module}</h3>
            <div className="space-y-1">
              {moduleDefinitions.map((definition) => (
                <label key={definition.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(definition.key)}
                    onChange={() => toggleKey(definition.key)}
                    disabled={!canWrite}
                  />
                  {definition.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canWrite && isDirty && (
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={submitting} className="px-2 py-1 text-xs">
            {submitting ? 'Saving…' : 'Save capabilities'}
          </Button>
          <Button variant="secondary" onClick={handleCancel} disabled={submitting} className="px-2 py-1 text-xs">
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
