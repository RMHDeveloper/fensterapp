import type { Project } from '../../types'
import { ProgressBar } from '../charts/ProgressBar'

interface Props {
  project: Project
  gradientIndex?: number
  onClick?: () => void
}

const GRADIENTS = [
  'from-blue-400 to-blue-700',
  'from-violet-400 to-purple-700',
  'from-teal-400 to-teal-700',
  'from-orange-400 to-orange-700',
  'from-rose-400 to-rose-700',
  'from-indigo-400 to-indigo-700',
]

function getDisplayStatus(project: Project): { label: string; bg: string } {
  if (project.status === 'completed') return { label: 'Completed', bg: 'bg-emerald-500' }
  if (project.status === 'on_hold')   return { label: 'On Hold',   bg: 'bg-amber-500'   }
  if (project.status === 'cancelled') return { label: 'Cancelled', bg: 'bg-red-500'     }
  if (project.status === 'new')       return { label: 'New',       bg: 'bg-slate-600'   }
  if (project.progress >= 70)         return { label: 'On Track',  bg: 'bg-emerald-500' }
  if (project.progress >= 40)         return { label: 'In Review', bg: 'bg-amber-500'   }
  return                                     { label: 'Starting',  bg: 'bg-blue-500'    }
}

export function ProjectCard({ project, gradientIndex = 0, onClick }: Props) {
  const gradient      = GRADIENTS[gradientIndex % GRADIENTS.length]
  const displayStatus = getDisplayStatus(project)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-slate-200 overflow-hidden active:scale-[0.98] transition-transform"
    >
      {/* Gradient image header */}
      <div className={`bg-gradient-to-br ${gradient} h-28 relative flex items-end p-4`}>
        {/* Status badge */}
        <span className={`absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full text-white ${displayStatus.bg}`}>
          {displayStatus.label}
        </span>
        {/* Team avatars */}
        {project.teamMembers && project.teamMembers.length > 0 && (
          <div className="flex -space-x-1.5">
            {project.teamMembers.slice(0, 4).map((initials, i) => (
              <div
                key={i}
                className="w-7 h-7 bg-white rounded-full border-2 border-white/80 flex items-center justify-center"
              >
                <span className="text-[9px] font-extrabold text-slate-700">{initials}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-4">
        <h3 className="text-sm font-extrabold text-slate-800 mb-1 leading-snug">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{project.description}</p>
        )}

        {/* Progress — colorful bar */}
        <ProgressBar percent={project.progress} />
      </div>
    </button>
  )
}
