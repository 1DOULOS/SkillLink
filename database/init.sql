-- SkillLink Database Initialization Script
-- Smart Internship & Job Matching System

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users table (auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'recruiter', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student profiles
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    bio TEXT,
    skills TEXT[] DEFAULT '{}',
    education JSONB DEFAULT '[]'::jsonb,
    experience JSONB DEFAULT '[]'::jsonb,
    cv_url VARCHAR(500),
    avatar_url VARCHAR(500),
    location VARCHAR(200),
    github_url VARCHAR(300),
    linkedin_url VARCHAR(300),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recruiter profiles
CREATE TABLE IF NOT EXISTS recruiter_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(200),
    company_website VARCHAR(300),
    company_description TEXT,
    company_logo_url VARCHAR(500),
    industry VARCHAR(100),
    position VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    skills_required TEXT[] DEFAULT '{}',
    location VARCHAR(200),
    job_type VARCHAR(50) CHECK (job_type IN ('internship', 'full-time', 'part-time', 'contract', 'remote')),
    salary_min INTEGER,
    salary_max INTEGER,
    deadline DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    cover_letter TEXT,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'rejected', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, job_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recruiter_profiles_updated_at BEFORE UPDATE ON recruiter_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed: Default admin account (password: Admin@123)
INSERT INTO users (email, password_hash, role) VALUES
('admin@skilllink.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Seed: Sample recruiter (password: Pass@123)
INSERT INTO users (id, email, password_hash, role) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'recruiter@techcorp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'recruiter')
ON CONFLICT (email) DO NOTHING;

INSERT INTO recruiter_profiles (user_id, first_name, last_name, company_name, company_website, company_description, industry, position) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Jane', 'Smith', 'TechCorp Cameroon', 'https://techcorp.cm', 'Leading technology solutions company in Central Africa', 'Technology', 'HR Manager')
ON CONFLICT (user_id) DO NOTHING;

-- Seed: Sample student (password: Pass@123)
INSERT INTO users (id, email, password_hash, role) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'student@university.cm', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'student')
ON CONFLICT (email) DO NOTHING;

INSERT INTO student_profiles (user_id, first_name, last_name, bio, skills, location) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'John', 'Doe', 'Computer Science student passionate about software development', ARRAY['JavaScript', 'Python', 'React', 'Node.js'], 'Yaoundé, Cameroon')
ON CONFLICT (user_id) DO NOTHING;

-- Seed: Sample jobs
INSERT INTO jobs (recruiter_id, title, description, requirements, skills_required, location, job_type, salary_min, salary_max, deadline) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Frontend Developer Intern', 'Join our team as a Frontend Developer Intern. You will work on building modern web applications using React.', 'Currently enrolled in a Computer Science or related program. Strong understanding of HTML, CSS, JavaScript.', ARRAY['React', 'JavaScript', 'CSS', 'HTML'], 'Yaoundé, Cameroon', 'internship', 80000, 150000, '2026-06-30'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Backend Developer', 'We are looking for a skilled Backend Developer to join our growing team.', 'BSc in Computer Science or related field. 2+ years experience with Node.js.', ARRAY['Node.js', 'PostgreSQL', 'REST APIs', 'Docker'], 'Douala, Cameroon', 'full-time', 200000, 400000, '2026-05-31'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Data Science Intern', 'Work with our data team to analyze business data and build ML models.', 'Student in Statistics, Computer Science or Data Science. Knowledge of Python and ML basics.', ARRAY['Python', 'Machine Learning', 'Pandas', 'SQL'], 'Remote', 'internship', 100000, 180000, '2026-07-15')
ON CONFLICT DO NOTHING;
