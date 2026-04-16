import { XMarkIcon } from '@heroicons/react/20/solid'

interface SkillBadgeProps {
  skill: string
  variant?: 'default' | 'matched' | 'missing'
  removable?: boolean
  onRemove?: (skill: string) => void
}

export default function SkillBadge({
  skill,
  variant = 'default',
  removable = false,
  onRemove,
}: SkillBadgeProps) {
  const variantClasses = {
    default: 'bg-primary-100 text-primary-700 border-primary-200',
    matched: 'bg-green-100 text-green-700 border-green-200',
    missing: 'bg-red-100 text-red-700 border-red-200',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]}`}
    >
      {skill}
      {removable && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(skill)}
          className="ml-0.5 hover:opacity-70 transition-opacity"
          aria-label={`Remove ${skill}`}
        >
          <XMarkIcon className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
