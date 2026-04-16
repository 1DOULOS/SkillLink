import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/common/Navbar'
import Sidebar from '../../components/common/Sidebar'
import JobCard from '../../components/common/JobCard'
import Pagination from '../../components/common/Pagination'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { jobAPI } from '../../services/api'
import { Job } from '../../types'

const JOB_TYPES = ['all', 'internship', 'full-time', 'part-time', 'contract', 'remote']

export default function BrowseJobs() {
  const { isAuthenticated, user } = useAuthStore()
  const isStudent = isAuthenticated && user?.role === 'student'

  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [jobType, setJobType] = useState('all')
  const [location, setLocation] = useState('')

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, limit: 12 }
      if (search) params.search = search
      if (jobType !== 'all') params.job_type = jobType
      if (location) params.location = location
      const res = await jobAPI.getAllJobs(params)
      const d = res.data.data
      setJobs(d.jobs || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
    } catch {
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [page, search, jobType, location])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchJobs() }

  const content = (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Browse Jobs & Internships</h1>
        <p className="text-gray-500 mb-6">{total} opportunities available</p>

        {/* Filters */}
        <div className="card mb-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field flex-1 min-w-48"
              placeholder="Search job title or keyword..."
            />
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="input-field w-40"
              placeholder="Location"
            />
            <select value={jobType} onChange={e => { setJobType(e.target.value); setPage(1) }} className="input-field w-40">
              {JOB_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <button type="submit" className="btn-primary px-6">Search</button>
            <button type="button" onClick={() => { setSearch(''); setJobType('all'); setLocation(''); setPage(1) }} className="btn-secondary">
              Clear
            </button>
          </form>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading jobs..." />
        ) : jobs.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-500">No jobs found matching your criteria.</p>
            <button onClick={() => { setSearch(''); setJobType('all'); setLocation(''); setPage(1) }} className="btn-primary mt-4">Clear Filters</button>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {jobs.map(job => <JobCard key={job.id} job={job} />)}
            </div>
            <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
          </>
        )}
      </div>
    </main>
  )

  if (isStudent) return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        {content}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {content}
    </div>
  )
}
