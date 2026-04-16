import { Link } from 'react-router-dom'
import Navbar from '../components/common/Navbar'

const features = [
  { icon: '🤖', title: 'AI-Powered Matching', desc: 'Our TF-IDF algorithm analyzes your skills and experience to find the best job matches for you.' },
  { icon: '📋', title: 'Easy Applications', desc: 'Apply to multiple jobs with one click. Track all your applications in one place.' },
  { icon: '💡', title: 'Smart Profiles', desc: 'Build a comprehensive profile with your CV, skills, and experience to stand out.' },
  { icon: '🏢', title: 'Recruiter Tools', desc: 'Post jobs, manage applications, and find the perfect candidate with AI-ranked results.' },
]

const steps = [
  { num: '01', title: 'Create Your Profile', desc: 'Sign up, fill in your details, upload your CV and list your skills.' },
  { num: '02', title: 'Get AI Matched', desc: 'Our algorithm analyzes thousands of job listings and ranks them by compatibility with your profile.' },
  { num: '03', title: 'Apply with Confidence', desc: 'See your match score before applying. Know exactly which skills you have and which you need.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white py-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-sm px-4 py-1.5 rounded-full mb-6">
            🤖 Powered by AI Matching Technology
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            Connect Your Skills<br />to Opportunities
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
            SkillLink intelligently matches students with internships and jobs based on their skills,
            education and experience. No more sifting through irrelevant listings.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-3 px-8 rounded-xl hover:bg-blue-50 transition-colors text-lg shadow-lg">
              Get Started Free →
            </Link>
            <Link to="/jobs" className="inline-flex items-center justify-center gap-2 border-2 border-white/50 text-white font-bold py-3 px-8 rounded-xl hover:bg-white/10 transition-colors text-lg">
              Browse Jobs
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-100 py-10">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8 text-center px-4">
          {[['500+', 'Job Listings'], ['1,200+', 'Students Registered'], ['80+', 'Partner Companies']].map(([num, label]) => (
            <div key={label}>
              <p className="text-4xl font-extrabold text-blue-600">{num}</p>
              <p className="text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">Why Choose SkillLink?</h2>
          <p className="text-gray-500 text-center mb-12">Everything you need to land your dream opportunity</p>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="card flex gap-4 items-start hover:shadow-md transition-shadow">
                <span className="text-4xl">{f.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-gray-500 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="space-y-8">
            {steps.map((step, i) => (
              <div key={step.num} className="flex gap-6 items-start">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {step.num}
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold text-xl text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-gray-500">{step.desc}</p>
                </div>
                {i < steps.length - 1 && <div className="hidden" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-purple-700 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to Find Your Perfect Match?</h2>
          <p className="text-blue-100 mb-8">Join students and recruiters already using SkillLink to make better connections.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="inline-flex justify-center items-center bg-white text-blue-700 font-bold py-3 px-8 rounded-xl hover:bg-blue-50 transition-colors">
              Start as Student
            </Link>
            <Link to="/register" className="inline-flex justify-center items-center border-2 border-white/50 text-white font-bold py-3 px-8 rounded-xl hover:bg-white/10 transition-colors">
              Post a Job
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 text-center">
        <p className="text-sm">© 2026 SkillLink — Smart Internship & Job Matching System. Built for SEN3244 Software Architecture.</p>
      </footer>
    </div>
  )
}
