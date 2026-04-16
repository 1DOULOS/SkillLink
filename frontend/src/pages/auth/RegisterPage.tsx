import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authAPI } from '../../services/api'

interface RegisterForm {
  email: string
  password: string
  confirmPassword: string
  first_name?: string
  last_name?: string
  company_name?: string
}

export default function RegisterPage() {
  const [role, setRole] = useState<'student' | 'recruiter' | null>(null)
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>()
  const navigate = useNavigate()
  const password = watch('password')

  const onSubmit = async (data: RegisterForm) => {
    if (!role) { toast.error('Please select a role'); return }
    setLoading(true)
    try {
      await authAPI.register({ ...data, role })
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">SL</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SkillLink</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-gray-500 text-sm">Join thousands connecting talent with opportunity</p>
        </div>

        {/* Role Selection */}
        {!role ? (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">I am a...</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setRole('student')}
                className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
              >
                <div className="text-4xl mb-3">🎓</div>
                <p className="font-semibold text-gray-800 group-hover:text-blue-700">Student</p>
                <p className="text-xs text-gray-500 mt-1">Find internships & jobs</p>
              </button>
              <button
                onClick={() => setRole('recruiter')}
                className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
              >
                <div className="text-4xl mb-3">🏢</div>
                <p className="font-semibold text-gray-800 group-hover:text-blue-700">Recruiter</p>
                <p className="text-xs text-gray-500 mt-1">Post jobs & hire talent</p>
              </button>
            </div>
            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        ) : (
          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setRole(null)} className="text-gray-400 hover:text-gray-600">
                ←
              </button>
              <span className="text-lg">{role === 'student' ? '🎓' : '🏢'}</span>
              <h2 className="font-semibold text-gray-800 capitalize">{role} Registration</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name</label>
                  <input {...register('first_name')} className="input-field" placeholder="John" />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input {...register('last_name')} className="input-field" placeholder="Doe" />
                </div>
              </div>

              {role === 'recruiter' && (
                <div>
                  <label className="label">Company Name <span className="text-red-500">*</span></label>
                  <input
                    {...register('company_name', { required: role === 'recruiter' ? 'Company name required' : false })}
                    className="input-field"
                    placeholder="TechCorp Ltd"
                  />
                  {errors.company_name && <p className="mt-1 text-xs text-red-600">{errors.company_name.message}</p>}
                </div>
              )}

              <div>
                <label className="label">Email <span className="text-red-500">*</span></label>
                <input
                  {...register('email', { required: 'Email required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Password <span className="text-red-500">*</span></label>
                <input
                  {...register('password', {
                    required: 'Password required',
                    minLength: { value: 8, message: 'Min 8 characters' },
                    pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Must contain uppercase, lowercase, and number' }
                  })}
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
              </div>

              <div>
                <label className="label">Confirm Password <span className="text-red-500">*</span></label>
                <input
                  {...register('confirmPassword', {
                    required: 'Please confirm password',
                    validate: v => v === password || 'Passwords do not match'
                  })}
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
