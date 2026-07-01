import type { Priority } from '../../types'

const CONFIG: Record<Priority, { dot: string; text: string; label: string }> = {
  low:      { dot: 'bg-slate-400',   text: 'text-slate-500',  label: 'Low'      },
  medium:   { dot: 'bg-amber-400',   text: 'text-amber-600',  label: 'Medium'   },
  high:     { dot: 'bg-orange-500',  text: 'text-orange-600', label: 'High'     },
  critical: { dot: 'bg-red-500',     text: 'text-red-600',    label: 'Critical' },
}

interface Props {
  priority: Priority
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function PriorityBadge({ priority, showLabel = true, size = 'sm' }: Props) {
  const c = CONFIG[priority]
  const dotSize = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2'
  const textSize = size === 'md' ? 'text-xs' : 'text-[11px]'

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${c.text} ${textSize}`}>
      <span className={`rounded-full flex-shrink-0 ${c.dot} ${dotSize}`} />
      {showLabel && c.label}
    </span>
  )
}
