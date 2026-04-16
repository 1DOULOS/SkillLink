import { useAuthStore } from '../store/authStore'
import { User } from '../types'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setAuth = useAuthStore((state) => state.setAuth)
  const logout = useAuthStore((state) => state.logout)
  const updateUser = useAuthStore((state) => state.updateUser)

  const isStudent = user?.role === 'student'
  const isRecruiter = user?.role === 'recruiter'
  const isAdmin = user?.role === 'admin'

  const getDisplayName = () => {
    if (!user) return ''
    return user.email.split('@')[0]
  }

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase()
    }
    if (firstName) return firstName[0].toUpperCase()
    return user?.email[0].toUpperCase() ?? '?'
  }

  const getDashboardPath = (u?: User | null) => {
    const target = u ?? user
    if (!target) return '/'
    switch (target.role) {
      case 'student':
        return '/student/dashboard'
      case 'recruiter':
        return '/recruiter/dashboard'
      case 'admin':
        return '/admin/dashboard'
      default:
        return '/'
    }
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    isStudent,
    isRecruiter,
    isAdmin,
    setAuth,
    logout,
    updateUser,
    getDisplayName,
    getInitials,
    getDashboardPath,
  }
}
