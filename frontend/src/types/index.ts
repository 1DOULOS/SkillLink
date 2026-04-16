export interface User {
  id: string;
  email: string;
  role: 'student' | 'recruiter' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  bio: string | null;
  skills: string[];
  education: Education[];
  experience: Experience[];
  cv_url: string | null;
  avatar_url: string | null;
  location: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  email?: string;
  created_at: string;
}

export interface RecruiterProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_website: string | null;
  company_description: string | null;
  company_logo_url: string | null;
  industry: string | null;
  position: string | null;
  phone: string | null;
  email?: string;
}

export interface Education {
  school: string;
  degree: string;
  field: string;
  year: string;
}

export interface Experience {
  company: string;
  role: string;
  duration: string;
  description: string;
}

export interface Job {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  requirements: string | null;
  skills_required: string[];
  location: string | null;
  job_type: 'internship' | 'full-time' | 'part-time' | 'contract' | 'remote';
  salary_min: number | null;
  salary_max: number | null;
  deadline: string | null;
  status: 'active' | 'closed' | 'draft';
  created_at: string;
  recruiter?: {
    company_name: string;
    company_logo_url: string | null;
    industry: string | null;
    first_name: string;
    last_name: string;
  };
  has_applied?: boolean;
  application_count?: number;
  match?: MatchScore;
}

export interface Application {
  id: string;
  student_id: string;
  job_id: string;
  cover_letter: string | null;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'accepted';
  created_at: string;
  job?: Job;
  student?: StudentProfile;
}

export interface MatchScore {
  score: number;
  skill_match: number;
  text_similarity: number;
  matched_skills: string[];
  missing_skills: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface StudentStats {
  totalApplications: number;
  pendingApplications: number;
  shortlistedApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
  profileCompletion: number;
}

export interface RecruiterStats {
  totalJobsPosted: number;
  activeJobs: number;
  totalApplicationsReceived: number;
  pendingApplications: number;
  shortlistedCandidates: number;
}

export interface AdminStats {
  totalStudents: number;
  totalRecruiters: number;
  totalJobs: number;
  totalApplications: number;
  recentRegistrations: number;
  registrationsByDay: { date: string; count: number }[];
}
