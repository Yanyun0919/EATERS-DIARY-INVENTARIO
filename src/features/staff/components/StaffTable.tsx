import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { staffEditRoute } from '@/shared/constants/routes'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils/cn'

type StaffProfile = Database['public']['Tables']['staff_profiles']['Row']

const roleLabels: Record<StaffProfile['role'], string> = {
  administrator: 'Administrador',
  manager: 'Gerente',
  purchasing: 'Compras',
  staff: 'Empleado',
}

interface StaffTableProps {
  staff: StaffProfile[]
  canWrite: boolean
  onToggleActive: (member: StaffProfile) => void
  togglingId: string | null
  localeNamesByStaff: Map<string, string[]>
}

export function StaffTable({ staff, canWrite, onToggleActive, togglingId, localeNamesByStaff }: StaffTableProps) {
  if (staff.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No se encontró personal.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Rol</th>
            <th className="px-3 py-2 font-medium">Locales</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => {
            const localeNames = localeNamesByStaff.get(member.id) ?? []
            return (
              <tr key={member.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{member.full_name}</td>
                <td className="px-3 py-2 text-neutral-500">{member.email}</td>
                <td className="px-3 py-2 text-neutral-500">{roleLabels[member.role]}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {localeNames.length > 0 ? (
                      localeNames.map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs font-medium text-neutral-700"
                        >
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      member.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600',
                    )}
                  >
                    {member.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link to={staffEditRoute(member.id)} className="text-sm text-accent hover:underline">
                      {canWrite ? 'Editar' : 'Ver'}
                    </Link>
                    {canWrite && (
                      <Button
                        variant="secondary"
                        onClick={() => onToggleActive(member)}
                        disabled={togglingId === member.id}
                        className="px-2 py-1 text-xs"
                      >
                        {member.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
