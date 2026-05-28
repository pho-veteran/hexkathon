import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuth } from './auth-context'

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { projects: list } = await apiFetch('/projects')
      setProjects(list || [])
      setActiveProjectId(prev => {
        if (prev && list.some(p => p.projectId === prev)) return prev
        return list[0]?.projectId || null
      })
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (isAuthenticated) load()
    else { setProjects([]); setActiveProjectId(null); setError(null) }
  }, [isAuthenticated, load])

  const createProject = useCallback(async (name) => {
    const p = await apiFetch('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    await load()
    setActiveProjectId(p.projectId)
    return p
  }, [load])

  const deleteProject = useCallback(async (id) => {
    await apiFetch(`/projects/${id}`, { method: 'DELETE' })
    await load()
  }, [load])

  const value = useMemo(() => ({
    projects, activeProjectId, loading, error,
    switchProject: setActiveProjectId,
    createProject, deleteProject, reload: load,
  }), [projects, activeProjectId, loading, error, createProject, deleteProject, load])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjects must be inside ProjectProvider')
  return ctx
}
