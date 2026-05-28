import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { Moon, Sun, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { useTheme } from '../context/theme-context'
import { useProjects } from '../context/project-context'

export default function AppLayout() {
  const { isAuthenticated, loading, user, logout } = useAuth()
  const { mode, toggle } = useTheme()
  const { projects, activeProjectId, switchProject, createProject } = useProjects()
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showProjectMenu) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowProjectMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProjectMenu])

  if (loading) return <div className="flex min-h-dvh items-center justify-center text-sm text-[var(--text-tertiary)]">Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />

  const activeProject = projects.find(p => p.projectId === activeProjectId)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    setCreating(true)
    try {
      await createProject(newProjectName.trim())
      setNewProjectName('')
      setShowProjectMenu(false)
    } catch {} finally { setCreating(false) }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-1)]/80 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">StudyBuddy</span>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowProjectMenu(!showProjectMenu)} className="flex items-center gap-1 rounded-md border border-[var(--surface-border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition hover:border-[var(--accent-on-surface)]">
              {activeProject?.name || 'No project'}
              <ChevronDown size={12} />
            </button>
            {showProjectMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] p-1 shadow-lg shadow-[var(--shadow-color)]" role="menu" onKeyDown={e => { if (e.key === 'Escape') setShowProjectMenu(false) }}>
                {projects.map(p => (
                  <button key={p.projectId} role="menuitem" onClick={() => { switchProject(p.projectId); setShowProjectMenu(false) }}
                    className={`block w-full rounded-md px-3 py-1.5 text-left text-xs transition ${p.projectId === activeProjectId ? 'bg-[var(--surface-2)] text-[var(--accent-on-surface)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}`}>
                    {p.name}
                  </button>
                ))}
                <hr className="my-1 border-[var(--surface-border)]" />
                <form onSubmit={handleCreate} className="flex gap-1 px-1 py-1">
                  <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="New project..." className="flex-1 rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none" />
                  <button type="submit" disabled={creating || !newProjectName.trim()} className="rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs text-white disabled:opacity-50">+</button>
                </form>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-tertiary)] hidden sm:block">{user?.email}</span>
          <button onClick={toggle} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="rounded-md p-1.5 text-[var(--text-tertiary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]">
            {mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={logout} aria-label="Sign out" className="rounded-md p-1.5 text-[var(--text-tertiary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--color-danger)]">
            <LogOut size={14} />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
