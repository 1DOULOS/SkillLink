import { useNavigate } from 'react-router-dom'
import { format, parseISO, isAfter } from 'date-fns'
import {
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { Job } from '../../types'
import SkillBadge from './SkillBadge'

interface JobCardProps {
  job: Job
  basePath?: string
}

const JOB_TYPE_COLORS: Record<string, string> = {
  internship: 'bg-green-100 text-green-700',
  'full-time': 'bg-blue-100 text-blue-700',
  'part-time': 'bg-purple-100 text-purple-700',
  contract: 'bg-orange-100 text-orange-700',
  remote: 'bg-teal-100 text-teal-700',
}

function MatchScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'bg-green-100 text-green-700 border-green-200'
      : score >= 50
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-red-100 text-red-700 border-red-200'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}
    >
      {Math.round(score)}% match
    </span>
  )
}

export default function JobCard({ job, basePath = '/jobs' }: JobCardProps) {
  const navigate = useNavigate()
  const companyName = job.recruiter?.company_name ?? 'Company'
  const initials = companyName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const visibleSkills = job.skills_required.slice(0, 4)
  const extraSkills = job.skills_required.length - visibleSkills.length

  const isDeadlineSoon =
    job.deadline &&
    isAfter(new Date(job.deadline), new Date()) &&
    isAfter(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      new Date(job.deadline)
    )

  return (
    <div
      onClick={() => navigate(`${basePath}/${job.id}`)}
      className="card cursor-pointer hover:shadow-md hover:border-primary-200 transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-sm overflow-hidden">
          {job.recruiter?.company_logo_url ? (
            <img
              src={job.recruiter.company_logo_url}
              alt={companyName}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
            {job.title}
          </h3>
          <p className="text-sm text-gray-500 truncate">{companyName}</p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {job.match && <MatchScoreBadge score={job.match.score} />}
          {job.has_applied && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
              <CheckCircleIcon className="h-3 w-3" />
              Applied
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
            JOB_TYPE_COLORS[job.job_type] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {job.job_type}
        </span>
        {job.location && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-gray-600 bg-gray-100">
            <MapPinIcon className="h-3 w-3" />
            {job.location}
          </span>
        )}
        {(job.salary_min || job.salary_max) && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-gray-600 bg-gray-100">
            <CurrencyDollarIcon className="h-3 w-3" />
            {job.salary_min && job.salary_max
              ? `$${job.salary_min.toLocaleString()} – $${job.salary_max.toLocaleString()}`
              : job.salary_min
              ? `From $${job.salary_min.toLocaleString()}`
              : `Up to $${job.salary_max!.toLocaleString()}`}
          </span>
        )}
      </div>

      {/* Skills */}
      {job.skills_required.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {visibleSkills.map((skill) => (
            <SkillBadge key={skill} skill={skill} />
          ))}
          {extraSkills > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs text-gray-500 bg-gray-50 border border-gray-200">
              +{extraSkills} more
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      {job.deadline && (
        <div
          className={`flex items-center gap-1 text-xs ${
            isDeadlineSoon ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          <ClockIcon className="h-3.5 w-3.5" />
          <span>
            {isAfter(new Date(job.deadline), new Date())
              ? `Deadline: ${format(parseISO(job.deadline), 'MMM d, yyyy')}`
              : 'Deadline passed'}
          </span>
        </div>
      )}
    </div>
  )
}
