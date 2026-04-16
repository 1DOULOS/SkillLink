import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Modal from '../../components/common/Modal'
import { jobAPI, applicationAPI } from '../../services/api'
import { Job } from '../../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated, user } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applyModal, setApplyModal] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [applying, setApplying] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await jobAPI.getJobById(id!)
        setJob(res.data.data)
        setHasApplied(res.data.data.has_applied || false)
      } catch { toast.error('Failed to load job') }
      finally { setLoading(false) }
    }
    if (id) fetch()
  }, [id])

  const handleApply = async () => {
    setApplying(true)
    try {
      await applicationAPI.apply(id!, coverLetter)
      setHasApplied(true)
      setApplyModal(false)
      toast.success('Application submitted successfully!')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to apply')
    } finally { setApplying(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="flex justify-center py-20"><LoadingSpinner /></div></div>
  if (!job) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="text-center py-20 text-gray-500">Job not found</div></div>

  const typeColors: Record<string, string> = {
    internship: 'bg-green-100 text-green-700',
    'full-time': 'bg-blue-100 text-blue-700',
    'part-time': 'bg-yellow-100 text-yellow-700',
    contract: 'bg-purple-100 text-purple-700',
    remote: 'bg-indigo-100 text-indigo-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/jobs" className="text-blue-600 text-sm hover:underline mb-4 inline-block">← Back to Jobs</Link>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <div className="card">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-2xl font-bold text-blue-600">
                  {job.recruiter?.company_name?.charAt(0) || 'C'}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                  <p className="text-gray-600">{job.recruiter?.company_name}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColors[job.job_type] || 'bg-gray-100 text-gray-700'}`}>
                      {job.job_type}
                    </span>
                    {job.location && <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">📍 {job.location}</span>}
                    {job.salary_min && <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      💰 {job.salary_min.toLocaleString()} - {job.salary_max?.toLocaleString()} XAF/month
                    </span>}
                    {job.deadline && <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600">
                      ⏰ Deadline: {format(new Date(job.deadline), 'MMM dd, yyyy')}
                    </span>}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h2 className="font-semibold text-gray-800 mb-2">Description</h2>
                <p className="text-gray-600 whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
              </div>

              {job.requirements && (
                <div className="mb-4">
                  <h2 className="font-semibold text-gray-800 mb-2">Requirements</h2>
                  <p className="text-gray-600 whitespace-pre-wrap text-sm leading-relaxed">{job.requirements}</p>
                </div>
              )}

              {job.skills_required?.length > 0 && (
                <div>
                  <h2 className="font-semibold text-gray-800 mb-2">Required Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {job.skills_required.map(skill => (
                      <span key={skill} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Match Score for students */}
            {user?.role === 'student' && job.match && (
              <div className="card border-blue-200">
                <h2 className="font-semibold text-gray-800 mb-3">🤖 Your Match Score</h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 ${job.match.score >= 70 ? 'border-green-500 text-green-600' : job.match.score >= 50 ? 'border-yellow-500 text-yellow-600' : 'border-red-400 text-red-500'}`}>
                    {job.match.score.toFixed(0)}%
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Skill Match: <strong>{job.match.skill_match.toFixed(0)}%</strong></p>
                    <p className="text-sm text-gray-600">Content Similarity: <strong>{job.match.text_similarity.toFixed(0)}%</strong></p>
                  </div>
                </div>
                {job.match.matched_skills.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-green-700 mb-1">✅ Matched Skills:</p>
                    <div className="flex flex-wrap gap-1">{job.match.matched_skills.map(s => <span key={s} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{s}</span>)}</div>
                  </div>
                )}
                {job.match.missing_skills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-600 mb-1">❌ Missing Skills:</p>
                    <div className="flex flex-wrap gap-1">{job.match.missing_skills.map(s => <span key={s} className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs">{s}</span>)}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card">
              {!isAuthenticated ? (
                <Link to="/login" className="btn-primary w-full text-center block">Login to Apply</Link>
              ) : user?.role === 'student' ? (
                hasApplied ? (
                  <div className="text-center">
                    <span className="inline-flex items-center gap-2 text-green-600 font-medium">✅ Already Applied</span>
                    <Link to="/student/applications" className="block mt-2 text-sm text-blue-600 hover:underline">View Applications</Link>
                  </div>
                ) : (
                  <button onClick={() => setApplyModal(true)} className="btn-primary w-full">Apply Now</button>
                )
              ) : (
                <p className="text-gray-500 text-sm text-center">Only students can apply</p>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Company</h3>
              <p className="font-medium text-gray-900">{job.recruiter?.company_name}</p>
              {job.recruiter?.industry && <p className="text-sm text-gray-500 mt-1">{job.recruiter.industry}</p>}
              <p className="text-sm text-gray-500 mt-1">Posted: {format(new Date(job.created_at), 'MMM dd, yyyy')}</p>
              {job.application_count !== undefined && (
                <p className="text-sm text-gray-500 mt-1">{job.application_count} applicant{job.application_count !== 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <Modal isOpen={applyModal} onClose={() => setApplyModal(false)} title="Apply for this Position">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">Applying to: <strong>{job.title}</strong> at {job.recruiter?.company_name}</p>
          <div>
            <label className="label">Cover Letter (optional)</label>
            <textarea
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              className="input-field h-32 resize-none"
              placeholder="Why are you a great fit for this role?"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setApplyModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleApply} disabled={applying} className="btn-primary flex-1">
              {applying ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
