import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ApplicationStatusBadge from '../../components/common/ApplicationStatusBadge'
import { studentAPI, applicationAPI, matchingAPI } from '../../services/api'
import { StudentStats, Application, Job } from '../../types'
import toast from 'react-hot-toast'

export default function StudentDashboard() {
  const [stats, setStats] = useState<StudentStats | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [matchedJobs, setMatchedJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, appsRes, matchRes] = await Promise.allSettled([
          studentAPI.getStats(),
          applicationAPI.getMyApplications({ limit: 5 }),
          matchingAPI.getMatchedJobs(3),
        ])
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data)
        if (appsRes.status === 'fulfilled') setApplications(appsRes.value.data.data?.applications || [])
        if (matchRes.status === 'fulfilled') setMatchedJobs(matchRes.value.data.data || [])
      } catch {
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center"><LoadingSpinner text="Loading dashboard..." /></div>
    </div>
  )

  const statCards = [
    { label: 'Total Applications', value: stats?.totalApplications ?? 0, color: 'blue', icon: '📋' },
    { label: 'Pending', value: stats?.pendingApplications ?? 0, color: 'yellow', icon: '⏳' },
    { label: 'Shortlisted', value: stats?.shortlistedApplications ?? 0, color: 'purple', icon: '⭐' },
    { label: 'Accepted', value: stats?.acceptedApplications ?? 0, color: 'green', icon: '✅' },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Student Dashboard</h1>

            {/* Profile completion warning */}
            {stats && stats.profileCompletion < 80 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-medium text-amber-800">Complete your profile to get better matches!</p>
                  <p className="text-sm text-amber-600 mt-0.5">Profile is {stats.profileCompletion}% complete</p>
                </div>
                <Link to="/student/profile" className="btn-primary text-sm py-1.5 px-4 bg-amber-600 hover:bg-amber-700">
                  Update Profile
                </Link>
              </div>
            )}

            {/* Profile Completion Bar */}
            {stats && (
              <div className="card mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Profile Completion</span>
                  <span className="text-sm font-bold text-blue-600">{stats.profileCompletion}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.profileCompletion}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {statCards.map(card => (
                <div key={card.label} className="card text-center">
                  <div className="text-3xl mb-2">{card.icon}</div>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Applications */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold text-gray-800">Recent Applications</h2>
                  <Link to="/student/applications" className="text-sm text-blue-600 hover:underline">View all</Link>
                </div>
                {applications.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-4xl mb-2">📭</p>
                    <p className="text-sm">No applications yet</p>
                    <Link to="/student/jobs" className="btn-primary text-sm py-1.5 px-4 mt-3 inline-block">Browse Jobs</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map(app => (
                      <div key={app.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{app.job?.title || 'Job'}</p>
                          <p className="text-xs text-gray-500">{app.job?.recruiter?.company_name || ''}</p>
                        </div>
                        <ApplicationStatusBadge status={app.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Matched Jobs */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold text-gray-800">🤖 AI Matched For You</h2>
                  <Link to="/student/matches" className="text-sm text-blue-600 hover:underline">View all</Link>
                </div>
                {matchedJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-4xl mb-2">🤖</p>
                    <p className="text-sm">Complete your profile to get AI matches</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matchedJobs.map((job: any) => (
                      <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{job.title}</p>
                          <p className="text-xs text-gray-500">{job.company_name || job.recruiter?.company_name}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${job.match?.score >= 70 ? 'text-green-600' : job.match?.score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {job.match?.score?.toFixed(0)}%
                          </span>
                          <p className="text-xs text-gray-400">match</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { to: '/student/jobs', label: 'Browse Jobs', icon: '🔍' },
                { to: '/student/matches', label: 'AI Matches', icon: '🤖' },
                { to: '/student/applications', label: 'My Applications', icon: '📋' },
                { to: '/student/profile', label: 'Edit Profile', icon: '✏️' },
              ].map(action => (
                <Link key={action.to} to={action.to} className="card text-center hover:shadow-md transition-shadow cursor-pointer hover:border-blue-200 border border-transparent">
                  <div className="text-2xl mb-1">{action.icon}</div>
                  <p className="text-sm font-medium text-gray-700">{action.label}</p>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
