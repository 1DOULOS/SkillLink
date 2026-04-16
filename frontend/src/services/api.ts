import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const axiosInstance = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach Bearer token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (data: {
    email: string
    password: string
    role: string
    first_name?: string
    last_name?: string
    company_name?: string
  }) => axiosInstance.post('/api/auth/register', data),

  login: (data: { email: string; password: string }) =>
    axiosInstance.post('/api/auth/login', data),

  logout: (refreshToken: string) =>
    axiosInstance.post('/api/auth/logout', { refreshToken }),

  getMe: () => axiosInstance.get('/api/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    axiosInstance.put('/api/auth/change-password', data),
}

// ─── Student API ─────────────────────────────────────────────────────────────

export const studentAPI = {
  getProfile: () => axiosInstance.get('/api/users/profile'),

  updateProfile: (data: {
    first_name?: string
    last_name?: string
    phone?: string
    bio?: string
    location?: string
    github_url?: string
    linkedin_url?: string
    education?: unknown[]
    experience?: unknown[]
  }) => axiosInstance.put('/api/users/profile', data),

  uploadCV: (file: File) => {
    const formData = new FormData()
    formData.append('cv', file)
    return axiosInstance.post('/api/users/cv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return axiosInstance.post('/api/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  updateSkills: (skills: string[]) =>
    axiosInstance.put('/api/users/skills', { skills }),

  getStats: () => axiosInstance.get('/api/users/stats'),

  getAllStudents: (params?: { page?: number; limit?: number; search?: string }) =>
    axiosInstance.get('/api/users/students', { params }),

  getStudentById: (id: string) => axiosInstance.get(`/api/users/students/${id}`),
}

// ─── Recruiter API ───────────────────────────────────────────────────────────

export const recruiterAPI = {
  getProfile: () => axiosInstance.get('/api/users/recruiter/profile'),

  updateProfile: (data: {
    first_name?: string
    last_name?: string
    company_name?: string
    company_website?: string
    company_description?: string
    industry?: string
    position?: string
    phone?: string
  }) => axiosInstance.put('/api/users/recruiter/profile', data),

  uploadLogo: (file: File) => {
    const formData = new FormData()
    formData.append('logo', file)
    return axiosInstance.post('/api/users/recruiter/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getStats: () => axiosInstance.get('/api/users/recruiter/stats'),

  getRecruiterById: (id: string) => axiosInstance.get(`/api/users/recruiter/${id}`),
}

// ─── Jobs API ────────────────────────────────────────────────────────────────

export const jobAPI = {
  getAllJobs: (params?: {
    page?: number
    limit?: number
    search?: string
    job_type?: string
    location?: string
    salary_min?: number
    salary_max?: number
    skills?: string
    status?: string
  }) => axiosInstance.get('/api/jobs', { params }),

  getJobById: (id: string) => axiosInstance.get(`/api/jobs/${id}`),

  createJob: (data: {
    title: string
    description: string
    requirements?: string
    skills_required: string[]
    location?: string
    job_type: string
    salary_min?: number
    salary_max?: number
    deadline?: string
    status: string
  }) => axiosInstance.post('/api/jobs', data),

  updateJob: (
    id: string,
    data: {
      title?: string
      description?: string
      requirements?: string
      skills_required?: string[]
      location?: string
      job_type?: string
      salary_min?: number
      salary_max?: number
      deadline?: string
      status?: string
    }
  ) => axiosInstance.put(`/api/jobs/${id}`, data),

  deleteJob: (id: string) => axiosInstance.delete(`/api/jobs/${id}`),

  getMyJobs: (params?: { page?: number; limit?: number; status?: string }) =>
    axiosInstance.get('/api/jobs/my', { params }),

  getJobStats: () => axiosInstance.get('/api/jobs/stats'),

  getJobApplications: (
    jobId: string,
    params?: { page?: number; limit?: number; status?: string }
  ) => axiosInstance.get(`/api/jobs/${jobId}/applications`, { params }),

  updateApplicationStatus: (jobId: string, appId: string, status: string) =>
    axiosInstance.put(`/api/jobs/${jobId}/applications/${appId}`, { status }),
}

// ─── Applications API ────────────────────────────────────────────────────────

export const applicationAPI = {
  apply: (jobId: string, coverLetter?: string) =>
    axiosInstance.post(`/api/applications/jobs/${jobId}`, {
      cover_letter: coverLetter,
    }),

  getMyApplications: (params?: {
    page?: number
    limit?: number
    status?: string
  }) => axiosInstance.get('/api/applications/my', { params }),

  withdraw: (id: string) => axiosInstance.delete(`/api/applications/${id}`),
}

// ─── Matching API ────────────────────────────────────────────────────────────

export const matchingAPI = {
  getMatchedJobs: (topN = 10) =>
    axiosInstance.get('/api/match/jobs', { params: { top_n: topN } }),

  getMatchedCandidates: (jobId: string, topN = 20) =>
    axiosInstance.get(`/api/match/candidates/${jobId}`, {
      params: { top_n: topN },
    }),

  getMatchScore: (studentId: string, jobId: string) =>
    axiosInstance.post('/api/match/score', {
      student_id: studentId,
      job_id: jobId,
    }),
}

// ─── Admin API ───────────────────────────────────────────────────────────────

export const adminAPI = {
  getAllUsers: (params?: {
    page?: number
    limit?: number
    role?: string
    search?: string
  }) => axiosInstance.get('/api/admin/users', { params }),

  getUserById: (id: string) => axiosInstance.get(`/api/admin/users/${id}`),

  updateUserStatus: (id: string, is_active: boolean) =>
    axiosInstance.put(`/api/admin/users/${id}/status`, { is_active }),

  deleteUser: (id: string) => axiosInstance.delete(`/api/admin/users/${id}`),

  getStats: () => axiosInstance.get('/api/admin/stats'),
}

export default axiosInstance
