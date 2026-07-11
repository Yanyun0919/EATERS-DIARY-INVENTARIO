import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/core/auth/useAuth'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { OfflineBanner } from '@/shared/components/OfflineBanner'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { cn } from '@/shared/utils/cn'

const navItems = [
  { label: 'Products', to: ROUTES.PRODUCTS },
  { label: 'Suppliers', to: ROUTES.SUPPLIERS },
  { label: 'Inventario', to: ROUTES.INVENTORY },
  { label: 'Conteos de Stock', to: ROUTES.STOCK_COUNTS },
]

const adminOnlyNavItems = [
  { label: 'Categories', to: ROUTES.CATEGORIES },
  { label: 'Stores', to: ROUTES.STORES },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { isAdministrator } = useStaffProfile()

  const items = isAdministrator ? [...navItems, ...adminOnlyNavItems] : navItems

  return (
    <div className="flex min-h-svh flex-col">
      <OfflineBanner />
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <nav className="flex items-center gap-4">
          <span className="text-sm font-semibold">Eaters Diary</span>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn('text-sm', isActive ? 'font-medium text-accent' : 'text-neutral-500 hover:text-text')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{user?.email}</span>
          <Button variant="secondary" onClick={() => void signOut()} className="px-3 py-1.5 text-xs">
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
