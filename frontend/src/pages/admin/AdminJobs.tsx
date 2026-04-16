import { useEffect, useState } from 'react'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Pagination from '../../components/common/Pagination'
import { jobAPI } from '../../services/api'
import { Job } from '../../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const fetch = async (p = page, q = search) => {
    setLoading(true)
    try {
      const params: any = { page: p, limit: 15 }
      if (q) params.search = q
      const res = await jobAPI.getAllJobs(params)
      const d = res.data.data
      setJobs(d.jobs || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
    } catch { toast.error('Failed to load jobs') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [page])

  const handleDelete = async (job: Job) => {
    if (!confirm(`Delete "${job.title}"?`)) return
    try {
      await jobAPI.deleteJob(job.id)
      toast.success('Job deleted')
      fetch()
    } catch { toast.error('Failed to delete job') }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">All Jobs</h1>
              <p className="text-gray-500 text-sm">{total} total listings</p>
            </div>

            <div className="flex gap-3 mb-6">
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetch(1, search)} className="input-field flex-1" placeholder="Search by title..." />
              <button onClick={() => { setPage(1); fetch(1, search) }} className="btn-primary px-6">Search</button>
            </div>

            {loading ? <LoadingSpinner /> : (
              <>
                <div className="card overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Title', 'Company', 'Type', 'Status', 'Applications', 'Posted', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {jobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-40 truncate">{job.title}</td>
                          <td className="px-4 py-3 text-gray-600">{job.recruiter?.company_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 capitalize">{job.job_type}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              job.status === 'active' ? 'bg-green-100 text-green-700'
                              : job.status === 'draft' ? 'bg-gray-100 text-gray-600'
                              : 'bg-red-100 text-red-600'
                            }`}>{job.status}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{(job as any).application_count || 0}</td>
                          <td className="px-4 py-3 text-gray-500">{format(new Date(job.created_at), 'MMM dd, yyyy')}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDelete(job)} className="text-xs text-red-500 hover:text-red-700 transition-colors">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {jobs.length === 0 && <div className="text-center py-10 text-gray-400">No jobs found</div>}
                </div>
                <div className="mt-4"><Pagination currentPage={page} totalPages={pages} onPageChange={setPage} /></div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
