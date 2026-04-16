import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { adminAPI } from '../../services/api'
import { AdminStats } from '../../types'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getStats()
      .then(res => setStats(res.data.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-screen"><Sidebar /><div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div></div>

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents ?? 0, icon: '🎓', color: 'blue' },
    { label: 'Total Recruiters', value: stats?.totalRecruiters ?? 0, icon: '🏢', color: 'purple' },
    { label: 'Total Jobs', value: stats?.totalJobs ?? 0, icon: '💼', color: 'green' },
    { label: 'Total Applications', value: stats?.totalApplications ?? 0, icon: '📋', color: 'orange' },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {statCards.map(c => (
                <div key={c.label} className="card text-center">
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <p className="text-3xl font-bold text-gray-900">{c.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Registration Trend Chart */}
              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">User Registrations (Last 7 Days)</h2>
                {stats?.registrationsByDay && stats.registrationsByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.registrationsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} name="Registrations" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No registration data yet</div>
                )}
              </div>

              {/* Quick Links */}
              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  {[
                    { to: '/admin/users', icon: '👥', label: 'Manage Users', desc: 'View, activate or deactivate user accounts' },
                    { to: '/admin/jobs', icon: '💼', label: 'Manage Jobs', desc: 'View and moderate all job listings' },
                  ].map(a => (
                    <Link key={a.to} to={a.to} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors">
                      <span className="text-2xl">{a.icon}</span>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{a.label}</p>
                        <p className="text-xs text-gray-500">{a.desc}</p>
                      </div>
                      <span className="ml-auto text-gray-400">→</span>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-medium text-amber-800">Recent Registrations</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{stats?.recentRegistrations ?? 0}</p>
                  <p className="text-xs text-amber-600">new users in the last 7 days</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
