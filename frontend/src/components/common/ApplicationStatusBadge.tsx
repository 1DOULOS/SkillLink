import { Application } from '../../types'

interface ApplicationStatusBadgeProps {
  status: Application['status']
}

export default function ApplicationStatusBadge({
  status,
}: ApplicationStatusBadgeProps) {
  const config: Record<
    Application['status'],
    { label: string; classes: string }
  > = {
    pending: {
      label: 'Pending',
      classes: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    reviewed: {
      label: 'Reviewed',
      classes: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    shortlisted: {
      label: 'Shortlisted',
      classes: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    accepted: {
      label: 'Accepted',
      classes: 'bg-green-100 text-green-700 border-green-200',
    },
    rejected: {
      label: 'Rejected',
      classes: 'bg-red-100 text-red-700 border-red-200',
    },
  }

  const { label, classes } = config[status]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}
    >
      {label}
    </span>
  )
}
