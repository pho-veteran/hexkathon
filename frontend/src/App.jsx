import { useState } from 'react'
import BattleCard from './components/BattleCard'
import AuthGate from './components/AuthGate'
import Workspace from './components/Workspace'
import { useAuth } from './context/AuthContext'
import './index.css'

export default function App() {
  const { isAuthenticated, loading } = useAuth()
  const [currentScreen, setCurrentScreen] = useState('workspace')
  const [activeQuizId, setActiveQuizId] = useState(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-lg">
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthGate />
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {currentScreen === 'workspace' ? (
        <Workspace
          onStartBattle={(quizId) => {
            setActiveQuizId(quizId)
            setCurrentScreen('battle')
          }}
        />
      ) : (
        <BattleCard
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
