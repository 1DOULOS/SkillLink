import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Pagination from '../../components/common/Pagination'
import Modal from '../../components/common/Modal'
import { jobAPI } from '../../services/api'
import { Job } from '../../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const TABS = ['all', 'active', 'draft', 'closed'] as const

export default function MyJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [deleteJob, setDeleteJob] = useState<Job | null>(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  const fetch = async (status = tab, p = page) => {
    setLoading(true)
    try {
      const params: any = { page: p, limit: 10 }
      if (status !== 'all') params.status = status
      const res = await jobAPI.getMyJobs(params)
      const d = res.data.data
      setJobs(d.jobs || [])
      setPages(d.pages || 1)
    } catch { toast.error('Failed to load jobs') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [tab, page])

  const handleDelete = async () => {
    if (!deleteJob) return
    setDeleting(true)
    try {
      await jobAPI.deleteJob(deleteJob.id)
      toast.success('Job deleted')
      setDeleteJob(null)
      fetch()
    } catch { toast.error('Failed to delete job') }
    finally { setDeleting(false) }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
              <Link to="/recruiter/post-job" className="btn-primary">➕ Post Job</Link>
            </div>

            <div className="flex gap-2 mb-6">
              {TABS.map(t => (
                <button key={t} onClick={() => { setTab(t); setPage(1) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                  {t}
                </button>
              ))}
            </div>

            {loading ? <LoadingSpinner /> : jobs.length === 0 ? (
              <div className="card text-center py-16">
                <p className="text-5xl mb-3">💼</p>
                <p className="text-gray-500 mb-4">No jobs found</p>
                <Link to="/recruiter/post-job" className="btn-primary inline-block">Post a Job</Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div key={job.id} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900">{job.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              job.status === 'active' ? 'bg-green-100 text-green-700'
                              : job.status === 'draft' ? 'bg-gray-100 text-gray-600'
                              : 'bg-red-100 text-red-600'
                            }`}>{job.status}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                            <span className="capitalize">{job.job_type}</span>
                            {job.location && <span>📍 {job.location}</span>}
                            <span>📋 {(job as any).application_count || 0} applications</span>
                            <span>Posted {format(new Date(job.created_at), 'MMM dd, yyyy')}</span>
                            {job.deadline && <span>⏰ Closes {format(new Date(job.deadline), 'MMM dd, yyyy')}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Link to={`/recruiter/jobs/${job.id}/applications`} className="btn-secondary text-sm py-1.5 px-3">Applications</Link>
                          <Link to={`/recruiter/post-job`} state={{ editJob: job }} className="btn-outline text-sm py-1.5 px-3">Edit</Link>
                          <button onClick={() => setDeleteJob(job)} className="btn-danger text-sm py-1.5 px-3">Delete</button>
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

      <Modal isOpen={!!deleteJob} onClose={() => setDeleteJob(null)} title="Delete Job">
        <p className="text-gray-600 mb-4">Are you sure you want to delete <strong>{deleteJob?.title}</strong>? This will also delete all applications for this job.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteJob(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">{deleting ? 'Deleting...' : 'Delete Job'}</button>
        </div>
      </Modal>
    </div>
  )
}
