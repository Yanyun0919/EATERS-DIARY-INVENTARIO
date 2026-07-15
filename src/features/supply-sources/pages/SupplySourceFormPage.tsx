import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES, supplySourceEditRoute } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'
import {
  getSupplySource,
  getSupplySourceLocaleConfig,
  createSupplySource,
  updateSupplySource,
} from '@/features/supply-sources/api/supplySources'
import { useProductionCenterStores } from '@/features/supply-sources/hooks/useSupplySources'
import { SupplySourceForm } from '@/features/supply-sources/components/SupplySourceForm'
import type { SupplySourceFormValues } from '@/features/supply-sources/schemas/supplySource'
import type { Database } from '@/core/supabase/database.types'

type SupplySource = Database['public']['Tables']['supply_sources']['Row']

const emptyFormValues: SupplySourceFormValues = {
  name: '',
  resolutionType: 'external',
  storeId: null,
  sortOrder: 0,
  isActive: true,
}

export function SupplySourceFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const { canWriteMasterData, loading: profileLoading } = useStaffProfile()

  const [supplySource, setSupplySource] = useState<SupplySource | null>(null)
  const [initialStoreId, setInitialStoreId] = useState<string | null>(null)
  const [recordLoading, setRecordLoading] = useState(!isNew)
  const [recordError, setRecordError] = useState<string | null>(null)

  const { data: productionCenterStores } = useProductionCenterStores()

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    setRecordLoading(true)
    Promise.all([getSupplySource(id), getSupplySourceLocaleConfig(id)])
      .then(([source, config]) => {
        if (cancelled) return
        setSupplySource(source)
        setInitialStoreId(config?.store_id ?? null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setRecordError(err instanceof Error ? err.message : 'Failed to load Supply Source')
      })
      .finally(() => {
        if (!cancelled) setRecordLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  if (profileLoading || recordLoading) {
    return <LoadingScreen />
  }

  if (!isNew && !supplySource) {
    return <p className="text-sm text-red-600">{recordError ?? 'Supply Source not found.'}</p>
  }

  const readOnly = !canWriteMasterData

  function toFormValues(source: SupplySource, storeId: string | null): SupplySourceFormValues {
    return {
      name: source.name,
      resolutionType: source.resolution_type,
      storeId,
      sortOrder: source.sort_order,
      isActive: source.is_active,
    }
  }

  async function handleSubmit(values: SupplySourceFormValues) {
    const input = {
      name: values.name,
      resolutionType: values.resolutionType,
      storeId: values.storeId,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
    }

    if (isNew) {
      const created = await createSupplySource(input)
      navigate(supplySourceEditRoute(created.id), { replace: true })
      return
    }

    if (!id) return
    const updated = await updateSupplySource(id, input)
    setSupplySource(updated)
    setInitialStoreId(values.resolutionType === 'internal' ? values.storeId : null)
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.SUPPLY_SOURCES)}
          className="text-sm text-accent hover:underline"
        >
          ← Back to Supply Sources
        </button>
        <h1 className="mt-2 text-lg font-semibold">{isNew ? 'Add Supply Source' : supplySource?.name}</h1>
      </div>

      <SupplySourceForm
        initialValues={supplySource ? toFormValues(supplySource, initialStoreId) : emptyFormValues}
        productionCenterStores={productionCenterStores ?? []}
        onSubmit={handleSubmit}
        submitLabel={isNew ? 'Create Supply Source' : 'Save changes'}
        readOnly={readOnly}
      />
    </div>
  )
}
