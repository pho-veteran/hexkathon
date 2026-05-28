import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, getAccessToken } from '../api/client'

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/projects')
      const next = data.projects || []
      setProjects(next)
      setActiveProjectId((current) => {
        if (current && next.some((project) => project.projectId === current)) {
          return current
        }
        return next[0]?.projectId || null
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const syncProjects = () => {
      if (!getAccessToken()) {
        setProjects([])
        setActiveProjectId(null)
        setLoading(false)
        return
      }
      loadProjects().catch(() => {})
    }

    syncProjects()
    window.addEventListener('auth-changed', syncProjects)
    return () => window.removeEventListener('auth-changed', syncProjects)
  }, [loadProjects])

  const createProject = useCallback(async (name) => {
    const project = await apiFetch('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    await loadProjects()
    setActiveProjectId(project.projectId)
    return project
  }, [loadProjects])

  const renameProject = useCallback(async (projectId, name) => {
    const project = await apiFetch(`/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    await loadProjects()
    setActiveProjectId(project.projectId)
    return project
  }, [loadProjects])

  const deleteProject = useCallback(async (projectId) => {
    const result = await apiFetch(`/projects/${projectId}`, { method: 'DELETE' })
    await loadProjects()
    return result
  }, [loadProjects])

  const switchProject = useCallback((projectId) => {
    setActiveProjectId(projectId)
  }, [])

  const value = useMemo(() => ({
    projects,
    activeProjectId,
    loading,
    reloadProjects: loadProjects,
    createProject,
    renameProject,
    deleteProject,
    switchProject,
  }), [projects, activeProjectId, loading, loadProjects, createProject, renameProject, deleteProject, switchProject])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProjects must be used inside ProjectProvider')
  }
  return context
}
