import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ApplicationStatusBadge from '../../components/common/ApplicationStatusBadge'
import Modal from '../../components/common/Modal'
import { jobAPI, matchingAPI } from '../../services/api'
import { Application } from '../../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'] as const

export default function JobApplications() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<any>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewStudent, setViewStudent] = useState<any>(null)
  const [aiRanked, setAiRanked] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      const [jobRes, appsRes] = await Promise.all([
        jobAPI.getJobById(jobId!),
        jobAPI.getJobApplications(jobId!, params),
      ])
      setJob(jobRes.data.data)
      setApplications(appsRes.data.data?.applications || [])
    } catch { toast.error('Failed to load applications') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchApplications() }, [jobId, statusFilter])

  const handleStatusChange = async (app: Application, newStatus: string) => {
    try {
      await jobAPI.updateApplicationStatus(jobId!, app.id, newStatus)
      toast.success(`Status updated to ${newStatus}`)
      fetchApplications()
    } catch { toast.error('Failed to update status') }
  }

  const loadAIRankings = async () => {
    setLoadingAI(true)
    try {
      const res = await matchingAPI.getMatchedCandidates(jobId!, 50)
      const ranked = res.data.data || []
      // Merge match scores into applications
      const merged = applications.map(app => {
        const match = ranked.find((r: any) => r.user_id === app.student_id || r.student_id === app.student_id)
        return { ...app, match }
      }).sort((a: any, b: any) => (b.match?.score || 0) - (a.match?.score || 0))
      setApplications(merged)
      setAiRanked(true)
      toast.success('Applications ranked by AI match score!')
    } catch { toast.error('Failed to load AI rankings') }
    finally { setLoadingAI(false) }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <Link to="/recruiter/jobs" className="text-blue-600 text-sm hover:underline mb-4 inline-block">← Back to Jobs</Link>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
                {job && <p className="text-gray-500">{job.title} — {applications.length} applicants</p>}
              </div>
              <button onClick={loadAIRankings} disabled={loadingAI || applications.length === 0} className="btn-primary flex items-center gap-2">
                {loadingAI ? '🤖 Ranking...' : '🤖 AI Rank Candidates'}
              </button>
            </div>

            {aiRanked && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">✅ Applications ranked by AI match score (highest first)</div>}

            {/* Status Filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {['all', ...STATUSES].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>

            {loading ? <LoadingSpinner /> : applications.length === 0 ? (
              <div className="card text-center py-16">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500">No applications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app: any) => (
                  <div key={app.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 flex-shrink-0">
                        {app.student?.first_name?.charAt(0) || app.student?.email?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {app.student?.first_name ? `${app.student.first_name} ${app.student.last_name}` : app.student?.email}
                            </p>
                            <p className="text-sm text-gray-500">{app.student?.email}</p>
                            {app.student?.location && <p className="text-xs text-gray-400">📍 {app.student.location}</p>}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(app.student?.skills || []).slice(0, 5).map((s: string) => (
                                <span key={s} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {app.match && (
                              <div className={`text-center px-3 py-1 rounded-lg text-xs font-bold ${app.match.score >= 70 ? 'bg-green-50 text-green-600' : app.match.score >= 50 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-500'}`}>
                                {app.match.score?.toFixed(0)}% match
                              </div>
                            )}
                            <ApplicationStatusBadge status={app.status} />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-3">
                          <p className="text-xs text-gray-400">Applied {format(new Date(app.created_at), 'MMM dd, yyyy')}</p>
                          {app.student?.cv_url && (
                            <a href={app.student.cv_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View CV</a>
                          )}
                          <button onClick={() => setViewStudent(app)} className="text-xs text-blue-600 hover:underline">Full Profile</button>
                          <select
                            value={app.status}
                            onChange={e => handleStatusChange(app, e.target.value)}
                            className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          >
                            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <Modal isOpen={!!viewStudent} onClose={() => setViewStudent(null)} title="Candidate Profile">
        {viewStudent && (
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-gray-900 text-lg">
                {viewStudent.student?.first_name} {viewStudent.student?.last_name}
              </p>
              <p className="text-gray-500 text-sm">{viewStudent.student?.email}</p>
            </div>
            {viewStudent.student?.bio && <p className="text-sm text-gray-600">{viewStudent.student.bio}</p>}
            {viewStudent.student?.skills?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Skills:</p>
                <div className="flex flex-wrap gap-1">
                  {viewStudent.student.skills.map((s: string) => <span key={s} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{s}</span>)}
                </div>
              </div>
            )}
            {viewStudent.cover_letter && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Cover Letter:</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{viewStudent.cover_letter}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
