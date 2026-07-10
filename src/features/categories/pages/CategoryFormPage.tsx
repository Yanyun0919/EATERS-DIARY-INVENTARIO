import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES, categoryEditRoute } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'
import { getCategory, createCategory, updateCategory } from '@/features/categories/api/categories'
import { CategoryForm } from '@/features/categories/components/CategoryForm'
import type { CategoryFormValues } from '@/features/categories/schemas/category'
import type { Database } from '@/core/supabase/database.types'

type Category = Database['public']['Tables']['categories']['Row']

const emptyFormValues: CategoryFormValues = {
  name: '',
  sortOrder: 0,
  isActive: true,
}

function toFormValues(category: Category): CategoryFormValues {
  return {
    name: category.name,
    sortOrder: category.sort_order,
    isActive: category.is_active,
  }
}

export function CategoryFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const { canWriteMasterData, loading: profileLoading } = useStaffProfile()

  const [category, setCategory] = useState<Category | null>(null)
  const [categoryLoading, setCategoryLoading] = useState(!isNew)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    setCategoryLoading(true)
    getCategory(id)
      .then((data) => {
        if (!cancelled) setCategory(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setCategoryError(err instanceof Error ? err.message : 'Failed to load category')
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  if (profileLoading || categoryLoading) {
    return <LoadingScreen />
  }

  if (!isNew && !category) {
    return <p className="text-sm text-red-600">{categoryError ?? 'Category not found.'}</p>
  }

  const readOnly = !canWriteMasterData

  async function handleSubmit(values: CategoryFormValues) {
    const input = {
      name: values.name,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
    }

    if (isNew) {
      const created = await createCategory(input)
      navigate(categoryEditRoute(created.id), { replace: true })
      return
    }

    if (!id) return
    const updated = await updateCategory(id, input)
    setCategory(updated)
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.CATEGORIES)}
          className="text-sm text-accent hover:underline"
        >
          ← Back to categories
        </button>
        <h1 className="mt-2 text-lg font-semibold">{isNew ? 'Add Category' : category?.name}</h1>
      </div>

      <CategoryForm
        initialValues={category ? toFormValues(category) : emptyFormValues}
        onSubmit={handleSubmit}
        submitLabel={isNew ? 'Create Category' : 'Save changes'}
        readOnly={readOnly}
      />
    </div>
  )
}
