import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES, storeEditRoute } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'
import { getStore, createStore, updateStore } from '@/features/stores/api/stores'
import { useBrands } from '@/features/stores/hooks/useStores'
import { usePermissionDefinitions, useStorePermissions } from '@/features/stores/hooks/useStorePermissions'
import {
  useAssignedAccounts,
  useUnassignedAccounts,
  useAllStaffProfiles,
} from '@/features/stores/hooks/useStoreAccounts'
import { StoreForm } from '@/features/stores/components/StoreForm'
import { StoreCapabilitiesEditor } from '@/features/stores/components/StoreCapabilitiesEditor'
import { StoreAccountsEditor } from '@/features/stores/components/StoreAccountsEditor'
import type { StoreFormValues } from '@/features/stores/schemas/store'
import type { Database } from '@/core/supabase/database.types'

type Store = Database['public']['Tables']['stores']['Row']

const emptyFormValues: StoreFormValues = {
  brandId: '',
  name: '',
  code: '',
  type: 'retail_store',
  address: '',
  isActive: true,
}

function toFormValues(store: Store): StoreFormValues {
  return {
    brandId: store.brand_id,
    name: store.name,
    code: store.code,
    type: store.type,
    address: store.address ?? '',
    isActive: store.is_active,
  }
}

export function StoreFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const { canWriteMasterData, loading: profileLoading } = useStaffProfile()

  const [store, setStore] = useState<Store | null>(null)
  const [storeLoading, setStoreLoading] = useState(!isNew)
  const [storeError, setStoreError] = useState<string | null>(null)

  const { data: brands } = useBrands()
  const { data: definitions } = usePermissionDefinitions()
  const { data: grants, refetch: refetchGrants } = useStorePermissions(id ?? null)
  const { data: assignments, refetch: refetchAssignments } = useAssignedAccounts(id ?? null)
  const { data: unassignedProfiles, refetch: refetchUnassigned } = useUnassignedAccounts()
  const { data: allProfiles } = useAllStaffProfiles()

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    setStoreLoading(true)
    getStore(id)
      .then((data) => {
        if (!cancelled) setStore(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setStoreError(err instanceof Error ? err.message : 'Failed to load store')
      })
      .finally(() => {
        if (!cancelled) setStoreLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  if (profileLoading || storeLoading) {
    return <LoadingScreen />
  }

  if (!isNew && !store) {
    return <p className="text-sm text-red-600">{storeError ?? 'Store not found.'}</p>
  }

  const readOnly = !canWriteMasterData

  async function handleSubmit(values: StoreFormValues) {
    const input = {
      brandId: values.brandId,
      name: values.name,
      code: values.code,
      type: values.type,
      address: values.address || null,
      isActive: values.isActive,
    }

    if (isNew) {
      const created = await createStore(input)
      navigate(storeEditRoute(created.id), { replace: true })
      return
    }

    if (!id) return
    const updated = await updateStore(id, input)
    setStore(updated)
  }

  function handleAccountsChanged() {
    refetchAssignments()
    refetchUnassigned()
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={() => navigate(ROUTES.STORES)} className="text-sm text-accent hover:underline">
          ← Back to stores
        </button>
        <h1 className="mt-2 text-lg font-semibold">{isNew ? 'Add Store' : store?.name}</h1>
      </div>

      <StoreForm
        initialValues={store ? toFormValues(store) : emptyFormValues}
        brands={brands ?? []}
        onSubmit={handleSubmit}
        submitLabel={isNew ? 'Create Store' : 'Save changes'}
        readOnly={readOnly}
      />

      {isNew ? (
        <p className="text-sm text-neutral-500">
          Save the store first to assign operational capabilities and login accounts.
        </p>
      ) : (
        <div className="max-w-lg space-y-6 border-t border-border pt-6">
          <StoreCapabilitiesEditor
            storeId={id!}
            definitions={definitions ?? []}
            grantedKeys={(grants ?? []).map((grant) => grant.permission_key)}
            canWrite={canWriteMasterData}
            onChanged={refetchGrants}
          />

          <StoreAccountsEditor
            storeId={id!}
            assignments={assignments ?? []}
            assignedProfiles={allProfiles ?? []}
            unassignedProfiles={unassignedProfiles ?? []}
            canWrite={canWriteMasterData}
            onChanged={handleAccountsChanged}
          />
        </div>
      )}
    </div>
  )
}
