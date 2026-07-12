import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/core/supabase/client'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'

// Reached via the emailed link from resetPasswordForEmail() -- used both for new-employee
// onboarding (createStaffAccount) and administrator-triggered resets (resetStaffPassword). The
// link itself establishes a temporary Supabase session before this page ever renders
// (detectSessionInUrl, on by default) -- this page only needs to check that session exists and
// then call updateUser(). No admin ever sets or sees this password.
export function SetPasswordPage() {
  const navigate = useNavigate()
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
      setCheckingSession(false)
    })
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate(ROUTES.HOME, { replace: true }), 1500)
  }

  if (checkingSession) {
    return <p className="text-sm text-neutral-500">Comprobando enlace…</p>
  }

  if (!hasSession) {
    return (
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-lg font-semibold text-text">Enlace no válido</h1>
        <p className="text-sm text-neutral-500">
          Este enlace no es válido o ha caducado. Pide a un Administrador que te envíe uno nuevo.
        </p>
        <Button variant="secondary" onClick={() => navigate(ROUTES.LOGIN)}>
          Volver al inicio de sesión
        </Button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="w-full max-w-sm space-y-2">
        <h1 className="text-lg font-semibold text-text">Contraseña actualizada</h1>
        <p className="text-sm text-neutral-500">Redirigiendo…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Configura tu contraseña</h1>
        <p className="text-sm text-neutral-500">Eaters Diary</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Nueva Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirmar Contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Guardando…' : 'Guardar Contraseña'}
      </Button>
    </form>
  )
}
