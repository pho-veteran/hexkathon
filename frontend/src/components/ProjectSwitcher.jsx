import { useState } from 'react'
import { useProjects } from '../context/ProjectContext'

export default function ProjectSwitcher() {
  const { projects, activeProjectId, switchProject, createProject, renameProject, deleteProject } = useProjects()
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState(null)

  const activeProject = projects.find((project) => project.projectId === activeProjectId) || null

  const handleCreate = async () => {
    if (!draftName.trim()) {
      return
    }
    try {
      setError(null)
      await createProject(draftName)
      setDraftName('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRename = async () => {
    if (!activeProjectId || !draftName.trim()) {
      return
    }
    try {
      setError(null)
      await renameProject(activeProjectId, draftName)
      setDraftName('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!activeProjectId) {
      return
    }
    if (!window.confirm('Delete this project and all project data?')) {
      return
    }
    try {
      setError(null)
      await deleteProject(activeProjectId)
      setDraftName('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Project</label>
      <select
        value={activeProjectId || ''}
        onChange={(event) => switchProject(event.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {projects.map((project) => (
          <option key={project.projectId} value={project.projectId}>{project.name}</option>
        ))}
      </select>
      <input
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        placeholder={activeProject ? `Rename ${activeProject.name} or add new` : 'Project name'}
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Create</button>
        <button onClick={handleRename} disabled={!activeProjectId} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60">Rename</button>
        <button onClick={handleDelete} disabled={!activeProjectId} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60">Delete</button>
      </div>
    </div>
  )
}
