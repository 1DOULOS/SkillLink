import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const res = await authAPI.login(data)
      const { user, accessToken } = res.data.data
      setAuth(user, accessToken)
      toast.success(`Welcome back, ${user.email}!`)
      if (user.role === 'student') navigate('/student/dashboard')
      else if (user.role === 'recruiter') navigate('/recruiter/dashboard')
      else navigate('/admin/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">SL</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SkillLink</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-gray-500 text-sm">Sign in to your account to continue</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                type="email"
                className="input-field"
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 font-medium hover:underline">Create one free</Link>
            </p>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <p className="font-semibold mb-1">Demo Accounts:</p>
          <p>Student: student@university.cm / Pass@123</p>
          <p>Recruiter: recruiter@techcorp.com / Pass@123</p>
          <p>Admin: admin@skilllink.com / password</p>
        </div>
      </div>
    </div>
  )
}
