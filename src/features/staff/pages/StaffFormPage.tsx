import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES, staffEditRoute } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils/cn'
import { useStores } from '@/features/stores/hooks/useStores'
import {
  getStaff,
  createStaffAccount,
  updateStaffGeneral,
  resetStaffPassword,
  countActiveAdministrators,
} from '@/features/staff/api/staff'
import { useStaffPermissionDefinitions, useStaffPermissionsFor } from '@/features/staff/hooks/useStaffPermissions'
import { useStaffLocales } from '@/features/staff/hooks/useStaffLocales'
import { StaffPermissionsEditor } from '@/features/staff/components/StaffPermissionsEditor'
import { StaffLocalesEditor } from '@/features/staff/components/StaffLocalesEditor'
import { staffCreateSchema, staffGeneralSchema } from '@/features/staff/schemas/staff'
import type { Database, StaffRole } from '@/core/supabase/database.types'

type StaffProfile = Database['public']['Tables']['staff_profiles']['Row']
type Tab = 'general' | 'permissions' | 'locales'

const inputClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50'

const roleOptions: { value: StaffRole; label: string }[] = [
  { value: 'administrator', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'purchasing', label: 'Compras' },
  { value: 'staff', label: 'Empleado' },
]

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export function StaffFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const { profile: currentProfile, canWriteMasterData, loading: profileLoading } = useStaffProfile()

  const [member, setMember] = useState<StaffProfile | null>(null)
  const [memberLoading, setMemberLoading] = useState(!isNew)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('general')
  const [activeAdminCount, setActiveAdminCount] = useState<number | null>(null)

  const { data: stores } = useStores({ isActive: true })
  const { data: definitions } = useStaffPermissionDefinitions()
  const { data: grants, refetch: refetchGrants } = useStaffPermissionsFor(id ?? null)
  const { data: assignedStoreIds, refetch: refetchLocales } = useStaffLocales(id ?? null)

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    setMemberLoading(true)
    getStaff(id)
      .then((data) => {
        if (!cancelled) setMember(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setMemberError(err instanceof Error ? err.message : 'No se pudo cargar el empleado')
      })
      .finally(() => {
        if (!cancelled) setMemberLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  useEffect(() => {
    if (!member || member.role !== 'administrator' || !member.is_active) {
      setActiveAdminCount(null)
      return
    }
    let cancelled = false
    countActiveAdministrators().then((count) => {
      if (!cancelled) setActiveAdminCount(count)
    })
    return () => {
      cancelled = true
    }
  }, [member])

  if (profileLoading || memberLoading) {
    return <LoadingScreen />
  }

  if (!isNew && !member) {
    return <p className="text-sm text-red-600">{memberError ?? 'Empleado no encontrado.'}</p>
  }

  const readOnly = !canWriteMasterData
  const isLastActiveAdministrator = member?.role === 'administrator' && member.is_active && activeAdminCount === 1

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'Información General' },
    { key: 'permissions', label: 'Permisos' },
    { key: 'locales', label: 'Locales' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.STAFF)}
          className="text-sm text-accent hover:underline"
        >
          ← Volver a Personal
        </button>
        {isNew ? (
          <h1 className="mt-2 text-lg font-semibold">Nuevo Empleado</h1>
        ) : (
          <>
            <h1 className="mt-2 text-lg font-semibold">{member?.full_name}</h1>
            <p className="text-sm text-neutral-500">Configuración</p>
          </>
        )}
      </div>

      {isNew ? (
        <CreateStaffForm stores={stores ?? []} readOnly={readOnly} navigate={navigate} />
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
                  tab === t.key ? 'border-accent text-accent' : 'border-transparent text-neutral-500 hover:text-text',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'general' && member && (
            <GeneralTab
              member={member}
              readOnly={readOnly}
              isLastActiveAdministrator={isLastActiveAdministrator}
              isOwnAccount={currentProfile?.id === member.id}
              onSaved={setMember}
            />
          )}

          {tab === 'permissions' && (
            <div className="max-w-lg">
              <StaffPermissionsEditor
                staffProfileId={id!}
                definitions={definitions ?? []}
                grantedKeys={(grants ?? []).map((grant) => grant.permission_key)}
                canWrite={canWriteMasterData}
                onChanged={refetchGrants}
              />
            </div>
          )}

          {tab === 'locales' && (
            <div className="max-w-lg">
              <StaffLocalesEditor
                staffProfileId={id!}
                stores={stores ?? []}
                assignedStoreIds={assignedStoreIds ?? []}
                canWrite={canWriteMasterData}
                onChanged={refetchLocales}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface CreateStaffFormProps {
  stores: Database['public']['Tables']['stores']['Row'][]
  readOnly: boolean
  navigate: ReturnType<typeof useNavigate>
}

function CreateStaffForm({ stores, readOnly, navigate }: CreateStaffFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('staff')
  const [storeIds, setStoreIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function toggleStore(storeId: string, checked: boolean) {
    setStoreIds((prev) => (checked ? [...prev, storeId] : prev.filter((id) => id !== storeId)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return

    const result = staffCreateSchema.safeParse({ fullName, email, role, storeIds, isActive })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setFormError(null)
    setSubmitting(true)
    try {
      const created = await createStaffAccount(result.data)
      navigate(staffEditRoute(created.id), { replace: true })
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="fullName"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          disabled={readOnly}
          className={inputClasses}
        />
        {errors.fullName && <p className="text-sm text-red-600">{errors.fullName}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={readOnly}
          className={inputClasses}
        />
        {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="role" className="text-sm font-medium">
          Rol
        </label>
        <select
          id="role"
          value={role}
          onChange={(event) => setRole(event.target.value as StaffRole)}
          disabled={readOnly}
          className={inputClasses}
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <span className="text-sm font-medium">Locales</span>
        <div className="space-y-1 rounded-md border border-border p-3">
          {stores.length === 0 && <p className="text-sm text-neutral-500">No hay locales activos.</p>}
          {stores.map((store) => (
            <label key={store.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={storeIds.includes(store.id)}
                onChange={(event) => toggleStore(store.id, event.target.checked)}
                disabled={readOnly}
              />
              {store.name}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          disabled={readOnly}
        />
        Activo
      </label>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {!readOnly && (
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear Empleado'}
        </Button>
      )}
    </form>
  )
}

interface GeneralTabProps {
  member: StaffProfile
  readOnly: boolean
  isLastActiveAdministrator: boolean
  isOwnAccount: boolean
  onSaved: (member: StaffProfile) => void
}

function GeneralTab({ member, readOnly, isLastActiveAdministrator, isOwnAccount, onSaved }: GeneralTabProps) {
  const [fullName, setFullName] = useState(member.full_name)
  const [role, setRole] = useState<StaffRole>(member.role)
  const [isActive, setIsActive] = useState(member.is_active)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  const lockRoleAndActive = readOnly || isLastActiveAdministrator

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return

    const result = staffGeneralSchema.safeParse({ fullName, role, isActive })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setFormError(null)

    // Self-edit safety net, distinct from the last-Administrator DB trigger: that trigger only
    // fires when this WOULD be the last active admin. With two or more admins, nothing at the
    // database level stops an Administrator from demoting or deactivating their own account --
    // still legal, just easy to do by accident while your own session is the one editing it.
    if (isOwnAccount && (result.data.role !== 'administrator' || !result.data.isActive)) {
      const confirmed = window.confirm(
        'Estás editando tu propia cuenta. Este cambio puede quitarte acceso de Administrador. ¿Continuar?',
      )
      if (!confirmed) return
    }

    setSubmitting(true)
    try {
      const updated = await updateStaffGeneral(member.id, result.data)
      onSaved(updated)
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword() {
    setResetMessage(null)
    setResettingPassword(true)
    try {
      await resetStaffPassword(member.email)
      setResetMessage('Correo de restablecimiento enviado.')
    } catch (err) {
      setResetMessage(extractErrorMessage(err))
    } finally {
      setResettingPassword(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="fullName" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={readOnly}
            className={inputClasses}
          />
          {errors.fullName && <p className="text-sm text-red-600">{errors.fullName}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input id="email" value={member.email} disabled className={inputClasses} />
        </div>

        <div className="space-y-1">
          <label htmlFor="role" className="text-sm font-medium">
            Rol
          </label>
          <select
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            disabled={lockRoleAndActive}
            className={inputClasses}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            disabled={lockRoleAndActive}
          />
          Activo
        </label>

        {isLastActiveAdministrator && (
          <p className="text-sm text-neutral-500">
            No se puede modificar el rol ni desactivar: es el último Administrador activo.
          </p>
        )}

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        {!readOnly && (
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar Cambios'}
          </Button>
        )}
      </form>

      {!readOnly && (
        <div className="space-y-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={handleResetPassword} disabled={resettingPassword} className="px-3 py-1.5 text-xs">
            {resettingPassword ? 'Enviando…' : 'Restablecer Contraseña'}
          </Button>
          {resetMessage && <p className="text-sm text-neutral-500">{resetMessage}</p>}
        </div>
      )}
    </div>
  )
}
