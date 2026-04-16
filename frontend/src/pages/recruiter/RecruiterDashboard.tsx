import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ApplicationStatusBadge from '../../components/common/ApplicationStatusBadge'
import { jobAPI, recruiterAPI } from '../../services/api'
import { RecruiterStats } from '../../types'
import toast from 'react-hot-toast'

export default function RecruiterDashboard() {
  const [stats, setStats] = useState<RecruiterStats | null>(null)
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [statsRes, jobsRes] = await Promise.allSettled([
          jobAPI.getJobStats(),
          jobAPI.getMyJobs({ page: 1, limit: 5 }),
        ])
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data)
        if (jobsRes.status === 'fulfilled') setRecentJobs(jobsRes.value.data.data?.jobs || [])
      } catch { toast.error('Failed to load dashboard') }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  if (loading) return <div className="flex h-screen"><Sidebar /><div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div></div>

  const cards = [
    { label: 'Total Jobs Posted', value: stats?.totalJobsPosted ?? 0, icon: '💼', color: 'blue' },
    { label: 'Active Jobs', value: stats?.activeJobs ?? 0, icon: '✅', color: 'green' },
    { label: 'Total Applications', value: stats?.totalApplicationsReceived ?? 0, icon: '📋', color: 'purple' },
    { label: 'Pending Review', value: stats?.pendingApplications ?? 0, icon: '⏳', color: 'yellow' },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Recruiter Dashboard</h1>
              <Link to="/recruiter/post-job" className="btn-primary flex items-center gap-2">
                ➕ Post a Job
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {cards.map(c => (
                <div key={c.label} className="card text-center">
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <p className="text-3xl font-bold text-gray-900">{c.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Jobs */}
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-800">My Job Listings</h2>
                <Link to="/recruiter/jobs" className="text-sm text-blue-600 hover:underline">View all</Link>
              </div>
              {recentJobs.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-2">💼</p>
                  <p className="text-gray-500 mb-3">No jobs posted yet</p>
                  <Link to="/recruiter/post-job" className="btn-primary inline-block">Post Your First Job</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-3 font-medium">Job Title</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Applications</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentJobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="py-3 font-medium text-gray-900">{job.title}</td>
                          <td className="py-3 text-gray-500 capitalize">{job.job_type}</td>
                          <td className="py-3 text-gray-500">{job.application_count || 0}</td>
                          <td className="py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              job.status === 'active' ? 'bg-green-100 text-green-700'
                              : job.status === 'draft' ? 'bg-gray-100 text-gray-600'
                              : 'bg-red-100 text-red-600'
                            }`}>{job.status}</span>
                          </td>
                          <td className="py-3">
                            <Link to={`/recruiter/jobs/${job.id}/applications`} className="text-blue-600 hover:underline text-xs">
                              View Applications
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
