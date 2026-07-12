import { supabase } from '@/core/supabase/client'
import { setStaffLocales } from '@/features/stores/api/storeAccounts'
import { ROUTES } from '@/shared/constants/routes'
import type { Database, StaffRole } from '@/core/supabase/database.types'

type StaffProfile = Database['public']['Tables']['staff_profiles']['Row']

export interface StaffFilters {
  search?: string
  role?: StaffRole
  isActive?: boolean
}

// Server-side search across both name and email via two parallel queries merged by id, rather
// than a single hand-built .or() string -- same pattern approved for Purchasing's search.
export async function listStaff(filters: StaffFilters = {}) {
  const search = filters.search?.trim()

  if (!search) {
    let query = supabase.from('staff_profiles').select('*').order('full_name', { ascending: true })
    if (filters.role) query = query.eq('role', filters.role)
    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive)
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  }

  let byNameQuery = supabase.from('staff_profiles').select('*').ilike('full_name', `%${search}%`)
  let byEmailQuery = supabase.from('staff_profiles').select('*').ilike('email', `%${search}%`)
  if (filters.role) {
    byNameQuery = byNameQuery.eq('role', filters.role)
    byEmailQuery = byEmailQuery.eq('role', filters.role)
  }
  if (filters.isActive !== undefined) {
    byNameQuery = byNameQuery.eq('is_active', filters.isActive)
    byEmailQuery = byEmailQuery.eq('is_active', filters.isActive)
  }

  const [byName, byEmail] = await Promise.all([byNameQuery, byEmailQuery])
  if (byName.error) throw byName.error
  if (byEmail.error) throw byEmail.error

  const merged = new Map<string, StaffProfile>()
  for (const row of [...(byName.data ?? []), ...(byEmail.data ?? [])]) {
    merged.set(row.id, row)
  }
  return [...merged.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export async function getStaff(id: string) {
  const { data, error } = await supabase.from('staff_profiles').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// Whether an administrator-role, active row is the sole remaining one -- used by the UI to
// proactively disable demoting/deactivating the last Administrator before the database trigger
// (enforce_last_administrator, migration 022) is ever reached.
export async function countActiveAdministrators() {
  const { count, error } = await supabase
    .from('staff_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'administrator')
    .eq('is_active', true)
  if (error) throw error
  return count ?? 0
}

export interface CreateStaffInput {
  fullName: string
  email: string
  role: StaffRole
  storeIds: string[]
  isActive: boolean
}

interface InviteUserSuccess {
  success: true
  userId: string
  email: string
}

type InviteUserFailureCode =
  | 'INVALID_REQUEST'
  | 'NOT_ADMINISTRATOR'
  | 'INVALID_REDIRECT_URL'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVITATION_FAILED'
  | 'UNKNOWN_ERROR'

interface InviteUserFailure {
  success: false
  code: InviteUserFailureCode
  message: string
}

type InviteUserResponse = InviteUserSuccess | InviteUserFailure

// The UI only ever switches on `code` -- `message` is English, meant for logs/debugging, never
// shown to Spanish-speaking restaurant staff directly.
const inviteFailureMessages: Record<InviteUserFailureCode, string> = {
  INVALID_REQUEST: 'La solicitud no es válida.',
  NOT_ADMINISTRATOR: 'No tienes permiso para invitar empleados.',
  INVALID_REDIRECT_URL: 'Error de configuración al enviar la invitación.',
  EMAIL_ALREADY_EXISTS: 'Ya existe una cuenta con este email.',
  INVITATION_FAILED: 'No se pudo enviar la invitación.',
  UNKNOWN_ERROR: 'Algo salió mal.',
}

// Creates the login via the invite-user Edge Function (auth.admin.inviteUserByEmail() under the
// hood -- see supabase/functions/invite-user) rather than auth.signUp(), which was built for
// self-registration, not administrator-provisioned accounts: it sent a redundant confirmation
// email, its duplicate-email handling was ambiguous by design (anti-enumeration protection that
// doesn't apply when the caller is a trusted Administrator), and it required a throwaway client
// to avoid hijacking the Administrator's own session. The Edge Function sends exactly one email
// (Supabase's actual Invite template) and never touches this client's session at all.
//
// The function itself only creates the Auth user -- staff_profiles/staff_stores are still
// written here, by this client, under the same RLS as every other write in this app.
export async function createStaffAccount(input: CreateStaffInput) {
  const { data, error } = await supabase.functions.invoke<InviteUserResponse>('invite-user', {
    body: {
      email: input.email,
      redirectTo: `${window.location.origin}${ROUTES.SET_PASSWORD}`,
    },
  })
  if (error) throw error
  if (!data || !data.success) {
    const code = data?.code ?? 'UNKNOWN_ERROR'
    // eslint-disable-next-line no-console
    console.error('invite-user failed:', code, data?.message)
    throw new Error(inviteFailureMessages[code])
  }

  const { data: profile, error: profileError } = await supabase
    .from('staff_profiles')
    .insert({
      user_id: data.userId,
      full_name: input.fullName,
      email: input.email,
      role: input.role,
      is_active: input.isActive,
    })
    .select()
    .single()
  if (profileError) throw profileError

  if (input.storeIds.length > 0) {
    await setStaffLocales(profile.id, input.storeIds)
  }

  return profile
}

export interface UpdateStaffGeneralInput {
  fullName: string
  role: StaffRole
  isActive: boolean
}

export async function updateStaffGeneral(id: string, input: UpdateStaffGeneralInput) {
  const { data, error } = await supabase
    .from('staff_profiles')
    .update({ full_name: input.fullName, role: input.role, is_active: input.isActive })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Administrator-triggered self-service reset -- never sets a password directly. The employee
// completes it themselves via the emailed link, landing on SetPasswordPage.
export async function resetStaffPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${ROUTES.SET_PASSWORD}`,
  })
  if (error) throw error
}

// List page's single-click Activar/Desactivar -- the last-Administrator guard trigger applies
// here exactly as it does to updateStaffGeneral, since both go through the same column.
export async function setStaffActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('staff_profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
