import { useEffect, useState } from 'react'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { studentAPI } from '../../services/api'
import { StudentProfile as IStudentProfile } from '../../types'
import toast from 'react-hot-toast'

export default function StudentProfile() {
  const [profile, setProfile] = useState<IStudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [uploadingCV, setUploadingCV] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', bio: '', location: '', github_url: '', linkedin_url: '' })

  const fetchProfile = async () => {
    try {
      const res = await studentAPI.getProfile()
      const p = res.data.data
      setProfile(p)
      setForm({ first_name: p.first_name || '', last_name: p.last_name || '', phone: p.phone || '', bio: p.bio || '', location: p.location || '', github_url: p.github_url || '', linkedin_url: p.linkedin_url || '' })
    } catch { toast.error('Failed to load profile') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProfile() }, [])

  const handleSaveInfo = async () => {
    setSaving(true)
    try {
      await studentAPI.updateProfile(form)
      toast.success('Profile updated!')
      fetchProfile()
    } catch { toast.error('Failed to update profile') }
    finally { setSaving(false) }
  }

  const addSkill = async () => {
    if (!newSkill.trim() || !profile) return
    const updated = [...(profile.skills || []), newSkill.trim()]
    try {
      await studentAPI.updateSkills(updated)
      setNewSkill('')
      fetchProfile()
      toast.success('Skill added!')
    } catch { toast.error('Failed to add skill') }
  }

  const removeSkill = async (skill: string) => {
    if (!profile) return
    const updated = profile.skills.filter(s => s !== skill)
    try {
      await studentAPI.updateSkills(updated)
      fetchProfile()
    } catch { toast.error('Failed to remove skill') }
  }

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Only PDF files allowed'); return }
    setUploadingCV(true)
    try {
      await studentAPI.uploadCV(file)
      toast.success('CV uploaded successfully!')
      fetchProfile()
    } catch { toast.error('Failed to upload CV') }
    finally { setUploadingCV(false) }
  }

  if (loading) return <div className="flex h-screen"><Sidebar /><div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div></div>

  const completion = profile?.skills?.length ? Math.min(100,
    (form.first_name ? 15 : 0) + (form.last_name ? 10 : 0) + (form.bio ? 15 : 0) +
    (form.location ? 10 : 0) + ((profile?.skills?.length || 0) > 0 ? 20 : 0) +
    (profile?.cv_url ? 20 : 0) + ((profile?.education?.length || 0) > 0 ? 10 : 0)
  ) : 10

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Completion:</span>
                <span className={`font-bold text-sm ${completion >= 80 ? 'text-green-600' : 'text-amber-600'}`}>{completion}%</span>
              </div>
            </div>

            {/* Completion Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${completion}%` }} />
            </div>

            {/* Personal Info */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Personal Information</h2>
              <div className="grid grid-cols-2 gap-4">
                {[['first_name', 'First Name'], ['last_name', 'Last Name']].map(([k, l]) => (
                  <div key={k}>
                    <label className="label">{l}</label>
                    <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="input-field" placeholder={l} />
                  </div>
                ))}
                <div>
                  <label className="label">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="+237 6XX XXX XXX" />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="input-field" placeholder="Yaoundé, Cameroon" />
                </div>
                <div className="col-span-2">
                  <label className="label">Bio</label>
                  <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="input-field h-24 resize-none" placeholder="Tell recruiters about yourself..." />
                </div>
                <div>
                  <label className="label">GitHub URL</label>
                  <input value={form.github_url} onChange={e => setForm(f => ({ ...f, github_url: e.target.value }))} className="input-field" placeholder="https://github.com/..." />
                </div>
                <div>
                  <label className="label">LinkedIn URL</label>
                  <input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} className="input-field" placeholder="https://linkedin.com/in/..." />
                </div>
              </div>
              <button onClick={handleSaveInfo} disabled={saving} className="btn-primary mt-4">{saving ? 'Saving...' : 'Save Information'}</button>
            </div>

            {/* Skills */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Skills</h2>
              <div className="flex gap-2 mb-3">
                <input
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  className="input-field flex-1"
                  placeholder="Type a skill and press Enter (e.g. React, Python)"
                />
                <button onClick={addSkill} className="btn-primary px-4">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile?.skills?.map(skill => (
                  <span key={skill} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="ml-1 text-blue-400 hover:text-red-500 text-xs">×</button>
                  </span>
                ))}
                {(!profile?.skills || profile.skills.length === 0) && (
                  <p className="text-gray-400 text-sm">No skills added yet. Add skills to improve your match score.</p>
                )}
              </div>
            </div>

            {/* CV Upload */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Curriculum Vitae (CV)</h2>
              {profile?.cv_url && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-green-700">✅ CV uploaded</span>
                  <a href={profile.cv_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">View CV →</a>
                </div>
              )}
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="file" accept=".pdf" className="hidden" onChange={handleCVUpload} disabled={uploadingCV} />
                <span className="text-3xl mb-1">📄</span>
                <p className="text-sm text-gray-600">{uploadingCV ? 'Uploading...' : 'Click to upload PDF (max 5MB)'}</p>
              </label>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
