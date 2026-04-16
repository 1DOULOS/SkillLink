import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { matchingAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function AIMatchesPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [topN, setTopN] = useState(10)

  const fetchMatches = async (n: number) => {
    setLoading(true)
    try {
      const res = await matchingAPI.getMatchedJobs(n)
      setJobs(res.data.data || res.data || [])
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load matches. Complete your profile first.')
      setJobs([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchMatches(topN) }, [])

  const scoreColor = (score: number) =>
    score >= 70 ? 'text-green-600 bg-green-50 border-green-200'
    : score >= 50 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-500 bg-red-50 border-red-200'

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="card mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🤖</span>
                <div>
                  <h1 className="text-2xl font-bold">AI-Powered Job Matches</h1>
                  <p className="text-blue-100 text-sm">Jobs ranked by compatibility with your profile using TF-IDF & cosine similarity</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <label className="text-sm text-blue-100">Show top:</label>
                <select
                  value={topN}
                  onChange={e => { setTopN(Number(e.target.value)); fetchMatches(Number(e.target.value)) }}
                  className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1 text-sm"
                >
                  {[5, 10, 20, 50].map(n => <option key={n} value={n} className="text-gray-900">{n} matches</option>)}
                </select>
                <button onClick={() => fetchMatches(topN)} className="ml-auto bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingSpinner text="Analyzing your profile and matching jobs..." />
            ) : jobs.length === 0 ? (
              <div className="card text-center py-16">
                <p className="text-5xl mb-4">📭</p>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">No matches found</h2>
                <p className="text-gray-500 mb-4">Complete your profile with skills, education, and experience to get AI-powered job recommendations.</p>
                <Link to="/student/profile" className="btn-primary inline-block">Complete Profile</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job: any, idx) => {
                  const match = job.match || {}
                  return (
                    <div key={job.id || idx} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        {/* Rank */}
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                          {idx + 1}
                        </div>

                        {/* Job Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <Link to={`/jobs/${job.id}`} className="font-semibold text-gray-900 hover:text-blue-600 text-lg">
                                {job.title}
                              </Link>
                              <p className="text-gray-500 text-sm">{job.company_name || job.recruiter?.company_name}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {job.location && <span className="text-xs text-gray-500">📍 {job.location}</span>}
                                {job.job_type && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{job.job_type}</span>}
                                {job.salary_min && <span className="text-xs text-gray-500">💰 {job.salary_min?.toLocaleString()} XAF</span>}
                              </div>
                            </div>

                            {/* Score Badge */}
                            <div className={`px-4 py-2 rounded-xl border text-center flex-shrink-0 ${scoreColor(match.score || 0)}`}>
                              <p className="text-2xl font-bold">{(match.score || 0).toFixed(0)}%</p>
                              <p className="text-xs font-medium">Match</p>
                            </div>
                          </div>

                          {/* Score Breakdown */}
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Skill Match</span>
                                <span className="font-medium">{(match.skill_match || 0).toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${match.skill_match || 0}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Content Similarity</span>
                                <span className="font-medium">{(match.text_similarity || 0).toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${match.text_similarity || 0}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* Skills */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(match.matched_skills || []).map((s: string) => (
                              <span key={s} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">✅ {s}</span>
                            ))}
                            {(match.missing_skills || []).slice(0, 3).map((s: string) => (
                              <span key={s} className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">❌ {s}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Link to={`/jobs/${job.id}`} className="btn-primary text-sm py-1.5 px-4">View & Apply</Link>
                        <Link to={`/jobs/${job.id}`} className="btn-secondary text-sm py-1.5 px-4">Details</Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
