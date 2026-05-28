import { useState } from 'react'
import BattleCard from './components/BattleCard'
import AuthGate from './components/AuthGate'
import CreateProjectGate from './components/CreateProjectGate'
import Workspace from './components/Workspace'
import { useAuth } from './context/AuthContext'
import { useProjects } from './context/ProjectContext'
import './index.css'

export default function App() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { loading: projectsLoading, projects, activeProjectId } = useProjects()
  const [currentScreen, setCurrentScreen] = useState('workspace')
  const [activeQuizId, setActiveQuizId] = useState(null)

  if (authLoading || (isAuthenticated && projectsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-lg text-slate-500">
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthGate />
  }

  if (projects.length === 0) {
    return <CreateProjectGate />
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {currentScreen === 'workspace' ? (
        <Workspace
          onStartBattle={(quizId) => {
            setActiveQuizId(quizId)
            setCurrentScreen('battle')
          }}
        />
      ) : (
        <BattleCard
          projectId={activeProjectId}
          quizId={activeQuizId}
          onEndBattle={() => {
            setCurrentScreen('workspace')
            setActiveQuizId(null)
          }}
        />
      )}
    </div>
  )
}
