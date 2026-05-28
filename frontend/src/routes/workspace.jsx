import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useProjects } from '../context/project-context'
import DocumentsPanel from '../components/documents-panel'
import ChatPanel from '../components/chat-panel'
import StudyPanel from '../components/study-panel'

function useResizable(key, defaultWidth, min, max) {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(`panel:${key}`)
    return stored ? Math.max(min, Math.min(max, Number(stored))) : defaultWidth
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onPointerDown = useCallback((e) => {
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      if (!dragging.current) return
      const delta = key === 'left' ? ev.clientX - startX.current : startX.current - ev.clientX
      const next = Math.max(min, Math.min(max, startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [width, key, min, max])

  useEffect(() => { localStorage.setItem(`panel:${key}`, String(width)) }, [width, key])

  const nudge = useCallback((delta) => {
    setWidth(w => Math.max(min, Math.min(max, w + delta)))
  }, [min, max])

  return { width, onPointerDown, nudge }
}

export default function Workspace() {
  const { activeProjectId, projects, loading: projectsLoading } = useProjects()
  const navigate = useNavigate()
  const left = useResizable('left', 260, 200, 360)
  const right = useResizable('right', 320, 280, 420)
  const [selectedDocIds, setSelectedDocIds] = useState([])

  // Reset selection on project switch
  useEffect(() => { setSelectedDocIds([]) }, [activeProjectId])

  if (projectsLoading) {
    return <div className="flex h-full items-center justify-center"><span className="text-xs text-[var(--text-tertiary)]">Loading projects...</span></div>
  }

  if (!activeProjectId && projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--text-secondary)]">Create your first project to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: Documents */}
      <div style={{ width: left.width }} className="shrink-0 overflow-hidden border-r border-[var(--surface-border)]">
        <DocumentsPanel projectId={activeProjectId} selectedDocIds={selectedDocIds} onSelectionChange={setSelectedDocIds} />
      </div>
      <div className="resize-handle" role="separator" aria-orientation="vertical" tabIndex={0} onPointerDown={left.onPointerDown} onKeyDown={e => { if (e.key === 'ArrowLeft') left.nudge(-10); if (e.key === 'ArrowRight') left.nudge(10) }} />

      {/* Center: Chat */}
      <div className="flex-1 min-w-[300px] overflow-hidden">
        <ChatPanel projectId={activeProjectId} selectedDocIds={selectedDocIds} />
      </div>

      <div className="resize-handle" role="separator" aria-orientation="vertical" tabIndex={0} onPointerDown={right.onPointerDown} onKeyDown={e => { if (e.key === 'ArrowLeft') right.nudge(10); if (e.key === 'ArrowRight') right.nudge(-10) }} />
      {/* Right: Quiz + Flashcards */}
      <div style={{ width: right.width }} className="shrink-0 overflow-hidden border-l border-[var(--surface-border)]">
        <StudyPanel projectId={activeProjectId} selectedDocIds={selectedDocIds} onStartBattle={(quizId) => navigate(`/battle/${quizId}`)} />
      </div>
    </div>
  )
}
