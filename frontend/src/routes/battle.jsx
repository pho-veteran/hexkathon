import { Navigate, useNavigate, useParams } from 'react-router'
import { useProjects } from '../context/project-context'
import BattleView from '../components/battle-view'

export default function Battle() {
  const { quizId } = useParams()
  const { activeProjectId } = useProjects()
  const navigate = useNavigate()

  if (!activeProjectId || !quizId) {
    return <Navigate to="/workspace" replace />
  }

  return <BattleView projectId={activeProjectId} quizId={quizId} onEnd={() => navigate('/workspace')} />
}
