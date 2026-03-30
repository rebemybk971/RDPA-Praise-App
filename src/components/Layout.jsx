import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/repertoire', label: 'Répertoire', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/>
    </svg>
  )},
  { to: '/evenements', label: 'Événements', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  )},
  { to: '/historique', label: 'Historique', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 3"/>
    </svg>
  )},
  { to: '/membres', label: 'Membres', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
]

function pageTitle(pathname) {
  if (pathname.includes('/repertoire')) return <><em>RDPA</em> Répertoire</>
  if (pathname.includes('/evenements')) return <><em>RDPA</em> Événements</>
  if (pathname.includes('/historique')) return <><em>RDPA</em> Historique</>
  if (pathname.includes('/membres'))    return <><em>RDPA</em> Membres</>
  return <><em>RDPA</em> Louange</>
}

export default function Layout() {
  const { cycleTheme, icon } = useTheme()
  const { signOut } = useAuth()
  const location = useLocation()

  const isJourJ = location.pathname.includes('/jour-j')

  return (
    <>
      {!isJourJ && (
        <header className="app-header">
          <h1>{pageTitle(location.pathname)}</h1>
          <button className="theme-btn" onClick={cycleTheme} title="Changer de mode">{icon}</button>
        </header>
      )}

      <main className="page-content">
        <Outlet />
      </main>

      {!isJourJ && (
        <nav className="bottom-nav">
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}
