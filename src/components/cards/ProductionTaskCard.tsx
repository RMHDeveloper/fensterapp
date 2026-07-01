import { AlertTriangle, Calendar, User } from 'lucide-react'
import { ProgressBar } from '../charts/ProgressBar'
import type { ProductionItem, ProductionStage } from '../../types'

const STAGE_ORDER: ProductionStage[] = [
  'cutting', 'routing', 'welding', 'assembly', 'glazing', 'packing', 'dispatch_ready',
]

const STAGE_LABEL: Record<ProductionStage, string> = {
  cutting:        'Cutting',
  routing:        'Routing',
  welding:        'Welding',
  assembly:       'Assembly',
  glazing:        'Glazing',
  packing:        'Packing',
  dispatch_ready: 'Ready to Ship',
}

const STAGE_STYLE: Record<ProductionStage, { bg: string; text: string }> = {
  cutting:        { bg: 'bg-orange-100', text: 'text-orange-700' },
  routing:        { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  welding:        { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  assembly:       { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  glazing:        { bg: 'bg-violet-100', text: 'text-violet-700' },
  packing:        { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  dispatch_ready: { bg: 'bg-emerald-100',text: 'text-emerald-700'},
}

interface Props {
  item: ProductionItem
  onUpdate: (item: ProductionItem) => void
}

export function ProductionTaskCard({ item, onUpdate }: Props) {
  const stageIdx   = STAGE_ORDER.indexOf(item.stage)
  const displayPct = item.progressPct ?? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100)
  const isDelayed  = item.delayDays > 0
  const stageStyle = STAGE_STYLE[item.stage]

  return (
    <div className={`w-full bg-white rounded-2xl border overflow-hidden shadow-sm ${isDelayed ? 'border-red-200' : 'border-slate-200'}`}>

      {/* Delay alert */}
      {isDelayed && (
        <div className="flex items-center gap-2.5 bg-red-50 border-b border-red-100 px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold text-red-600">{item.delayDays} day{item.delayDays > 1 ? 's' : ''} delayed</span>
          <span className="ml-auto text-xs font-bold text-red-400 bg-red-100 px-2 py-0.5 rounded-lg">Act Now</span>
        </div>
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold text-slate-800 leading-snug">{item.projectName}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{item.clientName}</p>
          </div>
          <span className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl ${stageStyle.bg} ${stageStyle.text}`}>
            {STAGE_LABEL[item.stage]}
          </span>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          {item.productType}
        </p>

        {/* Colorful progress bar */}
        <div className="mb-4">
          <ProgressBar percent={displayPct} label="Progress" />
          {/* Stage steps */}
          <div className="flex justify-between mt-2.5">
            {STAGE_ORDER.map((s, i) => (
              <span
                key={s}
                className={`text-[9px] font-semibold leading-tight text-center ${
                  i === stageIdx
                    ? 'text-blue-600 font-bold'
                    : i < stageIdx
                    ? 'text-slate-400'
                    : 'text-slate-200'
                }`}
                style={{ width: `${100 / STAGE_ORDER.length}%` }}
              >
                {s === 'dispatch_ready' ? 'Ship' : s.slice(0, 4)}
              </span>
            ))}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-slate-400 mb-5">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} aria-hidden="true" />
            <span className="font-semibold text-slate-600">{item.promisedDelivery}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <User size={12} aria-hidden="true" />
            <span className="font-semibold text-slate-600">{item.assignedManager}</span>
          </span>
        </div>

        {/* CTA button */}
        <button
          onClick={() => onUpdate(item)}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-opacity min-h-[48px] ${
            isDelayed
              ? 'bg-red-600 text-white active:bg-red-700'
              : item.status === 'done'
              ? 'bg-emerald-100 text-emerald-700 active:bg-emerald-200'
              : 'bg-blue-600 text-white active:bg-blue-700'
          }`}
        >
          {isDelayed ? 'Update Now — Delayed'
            : item.status === 'done' ? 'Done'
            : item.status === 'started' ? 'Update Status'
            : 'Update Status'}
        </button>
      </div>
    </div>
  )
}
