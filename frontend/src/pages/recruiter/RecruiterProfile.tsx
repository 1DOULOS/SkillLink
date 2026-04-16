import { useEffect, useState } from 'react'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { recruiterAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function RecruiterProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', company_name: '', company_website: '', company_description: '', industry: '', position: '', phone: '' })

  const fetchProfile = async () => {
    try {
      const res = await recruiterAPI.getProfile()
      const p = res.data.data
      setProfile(p)
      setForm({ first_name: p.first_name || '', last_name: p.last_name || '', company_name: p.company_name || '', company_website: p.company_website || '', company_description: p.company_description || '', industry: p.industry || '', position: p.position || '', phone: p.phone || '' })
    } catch { toast.error('Failed to load profile') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProfile() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await recruiterAPI.updateProfile(form)
      toast.success('Profile updated!')
      fetchProfile()
    } catch { toast.error('Failed to update profile') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex h-screen"><Sidebar /><div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div></div>

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>

            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Company Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Company Name</label>
                  <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="input-field" placeholder="Acme Corp" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Industry</label>
                    <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className="input-field" placeholder="Technology" />
                  </div>
                  <div>
                    <label className="label">Company Website</label>
                    <input value={form.company_website} onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))} className="input-field" placeholder="https://..." />
                  </div>
                </div>
                <div>
                  <label className="label">Company Description</label>
                  <textarea value={form.company_description} onChange={e => setForm(f => ({ ...f, company_description: e.target.value }))} className="input-field h-28 resize-none" placeholder="Tell candidates about your company..." />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Personal Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Position/Title</label>
                  <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="input-field" placeholder="HR Manager" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="+237 6XX XXX XXX" />
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
