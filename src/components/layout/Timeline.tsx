import { CheckCircle2, Circle, Clock } from 'lucide-react'

export type TimelineItemStatus = 'completed' | 'current' | 'upcoming'

export interface TimelineItem {
  id: string
  label: string
  date?: string
  description?: string
  status: TimelineItemStatus
}

interface Props {
  items: TimelineItem[]
}

const ICON: Record<TimelineItemStatus, React.ReactNode> = {
  completed: <CheckCircle2 size={18} className="text-emerald-500" />,
  current:   <Clock size={18} className="text-indigo-500" />,
  upcoming:  <Circle size={18} className="text-slate-300" />,
}

export function Timeline({ items }: Props) {
  return (
    <div className="relative">
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-3">
          {/* Icon + line */}
          <div className="flex flex-col items-center">
            <div className="flex-shrink-0 mt-0.5">{ICON[item.status]}</div>
            {i < items.length - 1 && (
              <div className={`w-0.5 flex-1 my-1 ${item.status === 'completed' ? 'bg-emerald-200' : 'bg-slate-200'}`} />
            )}
          </div>

          {/* Content */}
          <div className={`pb-4 ${i === items.length - 1 ? 'pb-0' : ''}`}>
            <p className={`text-sm font-semibold ${item.status === 'upcoming' ? 'text-slate-400' : 'text-slate-800'}`}>
              {item.label}
            </p>
            {item.date && (
              <p className="text-[11px] text-slate-400 mt-0.5">{item.date}</p>
            )}
            {item.description && (
              <p className="text-xs text-slate-500 mt-1">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
