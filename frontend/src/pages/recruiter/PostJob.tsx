import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import { jobAPI } from '../../services/api'
import toast from 'react-hot-toast'

interface JobForm {
  title: string
  description: string
  requirements: string
  location: string
  job_type: string
  salary_min: number
  salary_max: number
  deadline: string
  status: string
}

export default function PostJob({ editJob }: { editJob?: any }) {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<string[]>(editJob?.skills_required || [])
  const [newSkill, setNewSkill] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<JobForm>({
    defaultValues: editJob ? {
      title: editJob.title, description: editJob.description, requirements: editJob.requirements,
      location: editJob.location, job_type: editJob.job_type, salary_min: editJob.salary_min,
      salary_max: editJob.salary_max, deadline: editJob.deadline?.split('T')[0], status: editJob.status,
    } : { status: 'active', job_type: 'internship' }
  })

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()])
      setNewSkill('')
    }
  }

  const onSubmit = async (data: JobForm) => {
    setLoading(true)
    try {
      const payload = { ...data, skills_required: skills }
      if (editJob) {
        await jobAPI.updateJob(editJob.id, payload)
        toast.success('Job updated!')
      } else {
        await jobAPI.createJob(payload)
        toast.success('Job posted successfully!')
      }
      navigate('/recruiter/jobs')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save job')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">{editJob ? 'Edit Job' : 'Post a New Job'}</h1>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">Basic Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="label">Job Title <span className="text-red-500">*</span></label>
                    <input {...register('title', { required: 'Job title is required' })} className="input-field" placeholder="e.g. Frontend Developer Intern" />
                    {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Job Type <span className="text-red-500">*</span></label>
                      <select {...register('job_type', { required: true })} className="input-field">
                        {['internship', 'full-time', 'part-time', 'contract', 'remote'].map(t => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select {...register('status')} className="input-field">
                        <option value="active">Active (Published)</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Location</label>
                    <input {...register('location')} className="input-field" placeholder="e.g. Yaoundé, Cameroon or Remote" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Salary Min (XAF/month)</label>
                      <input {...register('salary_min', { valueAsNumber: true })} type="number" className="input-field" placeholder="80000" />
                    </div>
                    <div>
                      <label className="label">Salary Max (XAF/month)</label>
                      <input {...register('salary_max', { valueAsNumber: true })} type="number" className="input-field" placeholder="200000" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Application Deadline</label>
                    <input {...register('deadline')} type="date" className="input-field" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">Job Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="label">Description <span className="text-red-500">*</span></label>
                    <textarea {...register('description', { required: 'Description is required' })} className="input-field h-36 resize-none" placeholder="Describe the role, responsibilities, and your company..." />
                    {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
                  </div>
                  <div>
                    <label className="label">Requirements</label>
                    <textarea {...register('requirements')} className="input-field h-28 resize-none" placeholder="Education level, years of experience, specific certifications..." />
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">Required Skills</h2>
                <p className="text-sm text-gray-500 mb-3">Skills are used by our AI to match candidates. Be specific.</p>
                <div className="flex gap-2 mb-3">
                  <input
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    className="input-field flex-1"
                    placeholder="e.g. React, Python, PostgreSQL"
                  />
                  <button type="button" onClick={addSkill} className="btn-primary px-4">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                      {s}
                      <button type="button" onClick={() => setSkills(skills.filter(sk => sk !== s))} className="text-blue-400 hover:text-red-500 ml-1">×</button>
                    </span>
                  ))}
                  {skills.length === 0 && <p className="text-gray-400 text-sm">No skills added yet</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={() => navigate('/recruiter/jobs')} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Saving...' : editJob ? 'Update Job' : 'Post Job'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
