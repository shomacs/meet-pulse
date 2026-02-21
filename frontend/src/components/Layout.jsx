import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Avatar({ name, email }) {
  const letter = (name || email || '?')[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold select-none">
      {letter}
    </div>
  )
}

function AdminLink() {
  const { pathname } = useLocation()
  const { pendingApprovals } = useAuth()
  return (
    <Link
      to="/admin"
      className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        pathname.startsWith('/admin')
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      Admin
      {pendingApprovals > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {pendingApprovals > 9 ? '9+' : pendingApprovals}
        </span>
      )}
    </Link>
  )
}

function NavLink({ to, children }) {
  const { pathname } = useLocation()
  const active = pathname === to || (to !== '/' && pathname.startsWith(to))
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {children}
    </Link>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 text-sm hidden sm:block">SHOMACS MeetPulse</span>
          </Link>

          {/* Nav */}
          {user && (
            <nav className="flex items-center gap-1">
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/profile">Profile</NavLink>
              {user.is_admin && <AdminLink />}
            </nav>
          )}

          {/* User menu */}
          {user && (
            <div className="flex items-center gap-2">
              <Avatar name={user.name} email={user.email} />
              <span className="text-sm text-slate-700 font-medium hidden sm:block max-w-[120px] truncate">
                {user.name || user.email}
              </span>
              <button
                onClick={logout}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        SHOMACS MeetPulse
      </footer>
    </div>
  )
}
