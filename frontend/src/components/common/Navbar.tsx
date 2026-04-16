import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, isAuthenticated, logout, accessToken } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await authAPI.logout(accessToken || '')
    } catch {}
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  const initials = user
    ? `${user.email.charAt(0).toUpperCase()}`
    : '?'

  const dashboardLink =
    user?.role === 'student' ? '/student/dashboard'
    : user?.role === 'recruiter' ? '/recruiter/dashboard'
    : '/admin/dashboard'

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SL</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              SkillLink
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/jobs" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
              Browse Jobs
            </Link>
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="text-gray-600 hover:text-blue-600 text-sm font-medium">Login</Link>
                <Link to="/register" className="btn-primary text-sm py-1.5 px-4">Get Started</Link>
              </>
            ) : (
              <>
                <Link to={dashboardLink} className="text-gray-600 hover:text-blue-600 text-sm font-medium">
                  Dashboard
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 focus:outline-none"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{initials}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user?.email}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-medium text-gray-800 truncate">{user?.email}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize mt-1">
                          {user?.role}
                        </span>
                      </div>
                      <Link
                        to={dashboardLink}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Dashboard
                      </Link>
                      {user?.role === 'student' && (
                        <Link to="/student/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                          My Profile
                        </Link>
                      )}
                      {user?.role === 'recruiter' && (
                        <Link to="/recruiter/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                          Company Profile
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            <Link to="/jobs" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Browse Jobs</Link>
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Login</Link>
                <Link to="/register" className="block px-4 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg">Register</Link>
              </>
            ) : (
              <>
                <Link to={dashboardLink} className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Dashboard</Link>
                <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">Sign Out</button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
