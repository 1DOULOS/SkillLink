import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Auth Pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import BrowseJobs from './pages/student/BrowseJobs'
import JobDetailPage from './pages/student/JobDetailPage'
import AIMatchesPage from './pages/student/AIMatchesPage'
import MyApplications from './pages/student/MyApplications'
import StudentProfile from './pages/student/StudentProfile'

// Recruiter Pages
import RecruiterDashboard from './pages/recruiter/RecruiterDashboard'
import PostJob from './pages/recruiter/PostJob'
import MyJobs from './pages/recruiter/MyJobs'
import JobApplications from './pages/recruiter/JobApplications'
import RecruiterProfile from './pages/recruiter/RecruiterProfile'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import AdminJobs from './pages/admin/AdminJobs'

// Public Pages
import LandingPage from './pages/LandingPage'
import NotFoundPage from './pages/NotFoundPage'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: string[]
}

function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (isAuthenticated && user) {
    const redirect = user.role === 'student' ? '/student/dashboard'
      : user.role === 'recruiter' ? '/recruiter/dashboard'
      : '/admin/dashboard'
    return <Navigate to={redirect} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/jobs" element={<BrowseJobs />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />

        {/* Auth */}
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

        {/* Student */}
        <Route path="/student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/jobs" element={<ProtectedRoute roles={['student']}><BrowseJobs /></ProtectedRoute>} />
        <Route path="/student/matches" element={<ProtectedRoute roles={['student']}><AIMatchesPage /></ProtectedRoute>} />
        <Route path="/student/applications" element={<ProtectedRoute roles={['student']}><MyApplications /></ProtectedRoute>} />
        <Route path="/student/profile" element={<ProtectedRoute roles={['student']}><StudentProfile /></ProtectedRoute>} />

        {/* Recruiter */}
        <Route path="/recruiter/dashboard" element={<ProtectedRoute roles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
        <Route path="/recruiter/post-job" element={<ProtectedRoute roles={['recruiter']}><PostJob /></ProtectedRoute>} />
        <Route path="/recruiter/jobs" element={<ProtectedRoute roles={['recruiter']}><MyJobs /></ProtectedRoute>} />
        <Route path="/recruiter/jobs/:jobId/applications" element={<ProtectedRoute roles={['recruiter']}><JobApplications /></ProtectedRoute>} />
        <Route path="/recruiter/profile" element={<ProtectedRoute roles={['recruiter']}><RecruiterProfile /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UserManagement /></ProtectedRoute>} />
        <Route path="/admin/jobs" element={<ProtectedRoute roles={['admin']}><AdminJobs /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
