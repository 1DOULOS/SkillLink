import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const studentLinks = [
  { to: '/student/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/student/jobs', label: 'Browse Jobs', icon: '🔍' },
  { to: '/student/matches', label: 'AI Matches', icon: '🤖' },
  { to: '/student/applications', label: 'My Applications', icon: '📋' },
  { to: '/student/profile', label: 'My Profile', icon: '👤' },
]

const recruiterLinks = [
  { to: '/recruiter/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/recruiter/post-job', label: 'Post a Job', icon: '➕' },
  { to: '/recruiter/jobs', label: 'My Jobs', icon: '💼' },
  { to: '/recruiter/profile', label: 'Company Profile', icon: '🏢' },
]

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/jobs', label: 'Jobs', icon: '💼' },
]

export default function Sidebar() {
  const { user } = useAuthStore()
  const links = user?.role === 'student' ? studentLinks
    : user?.role === 'recruiter' ? recruiterLinks
    : adminLinks

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">{user?.email?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.email}</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">{user?.role}</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">SkillLink v1.0.0</p>
      </div>
    </aside>
  )
}
