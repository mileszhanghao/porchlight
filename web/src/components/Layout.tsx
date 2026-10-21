import { NavLink, Outlet } from 'react-router'
import { IS_DEMO } from '../api/client'
import { ROLE_LABEL, type User } from '../api/types'
import { useLogout } from '../auth'
import { DemoBar } from './DemoBar'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/book', label: 'Book a room' },
  { to: '/board', label: 'Board' },
]

export function Layout({ user }: { user: User }) {
  const logout = useLogout()
  return (
    <div className="min-h-screen">
      {IS_DEMO && <DemoBar user={user} />}
      <header className="bg-night text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-full bg-lamp shadow-[0_0_14px_4px_rgba(246,183,60,.55)]" />
            <span className="font-serif text-xl font-semibold">Porchlight</span>
            <span className="hidden text-sm text-white/60 sm:inline">Larkspur Court</span>
          </div>
          <nav aria-label="Main" className="flex flex-1 flex-wrap gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:text-white'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/80">
              {user.name}
              <span className="text-white/50">
                {' '}
                · {ROLE_LABEL[user.role]}
                {user.unit && user.role !== 'manager' ? `, ${user.unit}` : ''}
              </span>
            </span>
            <button onClick={() => logout.mutate()} className="rounded-md px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
