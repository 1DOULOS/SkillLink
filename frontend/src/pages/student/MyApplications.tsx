import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ApplicationStatusBadge from '../../components/common/ApplicationStatusBadge'
import Pagination from '../../components/common/Pagination'
import { applicationAPI } from '../../services/api'
import { Application } from '../../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const TABS = ['all', 'pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'] as const

export default function MyApplications() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  const fetch = async (status = tab, p = page) => {
    setLoading(true)
    try {
      const params: any = { page: p, limit: 10 }
      if (status !== 'all') params.status = status
      const res = await applicationAPI.getMyApplications(params)
      const d = res.data.data
      setApplications(d.applications || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
    } catch { toast.error('Failed to load applications') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [tab, page])

  const handleWithdraw = async (id: string) => {
    if (!confirm('Withdraw this application?')) return
    setWithdrawingId(id)
    try {
      await applicationAPI.withdraw(id)
      toast.success('Application withdrawn')
      fetch()
    } catch { toast.error('Failed to withdraw') }
    finally { setWithdrawingId(null) }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Applications</h1>
            <p className="text-gray-500 mb-6">{total} total applications</p>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setPage(1) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {loading ? <LoadingSpinner /> : applications.length === 0 ? (
              <div className="card text-center py-16">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-gray-500">No applications found</p>
                <Link to="/student/jobs" className="btn-primary inline-block mt-4">Browse Jobs</Link>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {applications.map(app => (
                    <div key={app.id} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Link to={`/jobs/${app.job_id}`} className="font-semibold text-gray-900 hover:text-blue-600 text-lg">
                            {app.job?.title || 'Job Title'}
                          </Link>
                          <p className="text-gray-500 text-sm">{app.job?.recruiter?.company_name || ''}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {app.job?.location && <span className="text-xs text-gray-400">📍 {app.job.location}</span>}
                            {app.job?.job_type && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{app.job.job_type}</span>}
                            <span className="text-xs text-gray-400">Applied {format(new Date(app.created_at), 'MMM dd, yyyy')}</span>
                          </div>
                          {app.cover_letter && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2 italic">"{app.cover_letter}"</p>
                          )}
                        </div>
                        <div className="ml-4 flex flex-col items-end gap-2">
                          <ApplicationStatusBadge status={app.status} />
                          {app.status === 'pending' && (
                            <button
                              onClick={() => handleWithdraw(app.id)}
                              disabled={withdrawingId === app.id}
                              className="text-xs text-red-500 hover:text-red-700 transition-colors"
                            >
                              {withdrawingId === app.id ? 'Withdrawing...' : 'Withdraw'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6"><Pagination currentPage={page} totalPages={pages} onPageChange={setPage} /></div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
