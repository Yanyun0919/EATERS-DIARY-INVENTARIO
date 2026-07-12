import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES, storeEditRoute } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'
import { getStore, createStore, updateStore } from '@/features/stores/api/stores'
import { usePermissionDefinitions, useStorePermissions } from '@/features/stores/hooks/useStorePermissions'
import { useStoreRoleDefinitions, useStoreRoles } from '@/features/stores/hooks/useStoreRoles'
import {
  useAssignedAccounts,
  useAssignableAccounts,
  useAllStaffProfiles,
} from '@/features/stores/hooks/useStoreAccounts'
import { StoreForm } from '@/features/stores/components/StoreForm'
import { StoreRolesEditor } from '@/features/stores/components/StoreRolesEditor'
import { DerivedCapabilitiesList } from '@/features/stores/components/DerivedCapabilitiesList'
import { OperationalStatusEditor } from '@/features/stores/components/OperationalStatusEditor'
import { StoreAccountsEditor } from '@/features/stores/components/StoreAccountsEditor'
import type { StoreFormValues } from '@/features/stores/schemas/store'
import type { Database } from '@/core/supabase/database.types'
import { cn } from '@/shared/utils/cn'

type Store = Database['public']['Tables']['stores']['Row']
type Tab = 'general' | 'roles' | 'accounts'

const emptyFormValues: StoreFormValues = {
  brandId: '',
  name: '',
  code: '',
  address: '',
  isActive: true,
}

function toFormValues(store: Store): StoreFormValues {
  return {
    brandId: store.brand_id,
    name: store.name,
    code: store.code,
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
  const [tab, setTab] = useState<Tab>('general')

  const { data: roleDefinitions } = useStoreRoleDefinitions()
  const { data: assignedRoles, refetch: refetchRoles } = useStoreRoles(id ?? null)
  const { data: definitions } = usePermissionDefinitions()
  const { data: grants, refetch: refetchGrants } = useStorePermissions(id ?? null)
  const { data: assignments, refetch: refetchAssignments } = useAssignedAccounts(id ?? null)
  const { data: assignableProfiles, refetch: refetchAssignable } = useAssignableAccounts(id ?? null)
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
        if (!cancelled) setStoreError(err instanceof Error ? err.message : 'No se pudo cargar el local')
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
    return <p className="text-sm text-red-600">{storeError ?? 'Local no encontrado.'}</p>
  }

  const readOnly = !canWriteMasterData

  async function handleSubmit(values: StoreFormValues) {
    const input = {
      brandId: values.brandId,
      name: values.name,
      code: values.code,
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
    refetchAssignable()
  }

  function handleRolesChanged() {
    refetchRoles()
    refetchGrants()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'Información General' },
    { key: 'roles', label: 'Roles' },
    { key: 'accounts', label: 'Cuentas de Acceso' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={() => navigate(ROUTES.STORES)} className="text-sm text-accent hover:underline">
          ← Volver a Locales
        </button>
        {isNew ? (
          <h1 className="mt-2 text-lg font-semibold">Nuevo Local</h1>
        ) : (
          <>
            <h1 className="mt-2 text-lg font-semibold">{store?.name}</h1>
            <p className="text-sm text-neutral-500">Configuración</p>
          </>
        )}
      </div>

      {isNew ? (
        <StoreForm
          initialValues={emptyFormValues}
          onSubmit={handleSubmit}
          submitLabel="Crear Local"
          readOnly={readOnly}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'border-b-2 px-1 pb-2 text-sm font-medium',
                  tab === t.key
                    ? 'border-accent text-accent'
                    : 'border-transparent text-neutral-500 hover:text-text',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'general' && (
            <StoreForm
              initialValues={store ? toFormValues(store) : emptyFormValues}
              onSubmit={handleSubmit}
              submitLabel="Guardar Cambios"
              readOnly={readOnly}
            />
          )}

          {tab === 'roles' && (
            <div className="max-w-lg space-y-6">
              <StoreRolesEditor
                storeId={id!}
                roleDefinitions={roleDefinitions ?? []}
                assignedRoleKeys={(assignedRoles ?? []).map((role) => role.role_key)}
                permissionDefinitions={definitions ?? []}
                canWrite={canWriteMasterData}
                onChanged={handleRolesChanged}
              />

              <DerivedCapabilitiesList permissions={grants ?? []} definitions={definitions ?? []} />

              <OperationalStatusEditor
                storeId={id!}
                permissions={grants ?? []}
                definitions={definitions ?? []}
                canWrite={canWriteMasterData}
                onChanged={refetchGrants}
              />
            </div>
          )}

          {tab === 'accounts' && (
            <div className="max-w-lg">
              <StoreAccountsEditor
                storeId={id!}
                assignments={assignments ?? []}
                assignedProfiles={allProfiles ?? []}
                assignableProfiles={assignableProfiles ?? []}
                canWrite={canWriteMasterData}
                onChanged={handleAccountsChanged}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
