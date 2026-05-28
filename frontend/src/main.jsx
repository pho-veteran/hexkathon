import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { ThemeProvider } from './context/theme-context'
import { AuthProvider } from './context/auth-context'
import { ProjectProvider } from './context/project-context'
import AuthLayout from './routes/_auth-layout'
import AppLayout from './routes/_app-layout'
import Login from './routes/login'
import Register from './routes/register'
import ForgotPassword from './routes/forgot-password'
import VerifyCode from './routes/verify-code'
import Workspace from './routes/workspace'
import Battle from './routes/battle'
import './theme.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify" element={<VerifyCode />} />
              </Route>
              <Route element={<AppLayout />}>
                <Route path="/workspace" element={<Workspace />} />
                <Route path="/battle/:quizId" element={<Battle />} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
