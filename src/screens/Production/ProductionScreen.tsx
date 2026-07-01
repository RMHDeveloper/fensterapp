import { useState } from 'react'
import {
  AlertTriangle, Layers, BarChart2, Users,
} from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { ProductionTaskCard } from '../../components/cards/ProductionTaskCard'
import { FileUploadField } from '../../components/forms/FileUploadField'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { ProductionItem, ProductionStage } from '../../types'

type Filter = 'all' | ProductionStage | 'delayed'

const STAGE_ORDER: ProductionStage[] = [
  'cutting', 'routing', 'welding', 'assembly', 'glazing', 'packing', 'dispatch_ready',
]

const STAGE_COLOR: Record<ProductionStage, string> = {
  cutting:        'bg-orange-100 text-orange-700',
  routing:        'bg-amber-100 text-amber-700',
  welding:        'bg-yellow-100 text-yellow-700',
  assembly:       'bg-blue-100 text-blue-700',
  glazing:        'bg-violet-100 text-violet-700',
  packing:        'bg-teal-100 text-teal-700',
  dispatch_ready: 'bg-emerald-100 text-emerald-700',
}

const FILTERS: { value: Filter; label: string; emoji: string }[] = [
  { value: 'all',          label: 'All Work',  emoji: '📋' },
  { value: 'cutting',      label: 'Cutting',   emoji: '✂️' },
  { value: 'welding',      label: 'Welding',   emoji: '⚡' },
  { value: 'assembly',     label: 'Assembly',  emoji: '🔧' },
  { value: 'glazing',      label: 'Glazing',   emoji: '🪟' },
  { value: 'packing',      label: 'Packing',   emoji: '📦' },
  { value: 'delayed',      label: 'Delayed',   emoji: '⚠️' },
]

function getFilterCount(f: Filter, items: ProductionItem[]): number {
  if (f === 'all')     return items.length
  if (f === 'delayed') return items.filter(p => p.delayDays > 0).length
  return items.filter(p => p.stage === f).length
}

function getSectionTitle(f: Filter): string {
  if (f === 'all')     return 'All Work'
  if (f === 'delayed') return 'Delayed Work'
  const label = f.replace('_', ' ')
  return `${label.charAt(0).toUpperCase() + label.slice(1)} Work`
}

export default function ProductionScreen() {
  const { production, updateProductionStage } = useAppData()
  const { user } = useAuth()
  const [filter, setFilter]     = useState<Filter>('all')
  const [selected, setSelected] = useState<ProductionItem | null>(null)
  const [nextStage, setNextStage] = useState<ProductionStage | null>(null)
  const [proofFiles, setProofFiles] = useState<string[]>([])
  const [proofError, setProofError] = useState<string | undefined>()
  const [snack, setSnack]       = useState({ open: false, msg: '' })

  const isProductionTeam = user?.role === 'production_team'

  function openSheet(item: ProductionItem) {
    setProofFiles([])
    setProofError(undefined)
    setSelected(item)
  }

  function handleMarkDone() {
    if (!selected) return
    if (isProductionTeam && proofFiles.length === 0) {
      setProofError('Upload production photo to complete this task.')
      return
    }
    updateProductionStage(selected.id, 'dispatch_ready', 'done')
    setSelected(null)
    setSnack({ open: true, msg: 'Task completed successfully.' })
  }

  const filtered = production.filter(p => {
    if (filter === 'all')     return true
    if (filter === 'delayed') return p.delayDays > 0
    return p.stage === filter
  })

  const totalCount   = production.length
  const delayedCount = production.filter(p => p.delayDays > 0).length
  const startedCount = production.filter(p => p.status === 'started').length
  const doneCount    = production.filter(p => p.status === 'done').length

  const TEAM = ['Ravi K.', 'Mohan R.', 'Sathish P.', 'Kumar S.']

  return (
    <div className="min-h-screen bg-[#f8f9fa] lg:bg-[#f0f2f5] pb-24 lg:pb-8">
      <AppHeader />
      {/* Sticky sub-header */}
      <div className="bg-white px-4 pt-4 pb-5 border-b border-slate-200 sticky top-14 z-20">
        <div className="lg:max-w-5xl lg:mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">Production</h1>
              <p className="text-sm text-slate-500 mt-0.5">Track work stage by stage</p>
            </div>
          </div>
          {delayedCount > 0 && (
            <button
              onClick={() => setFilter('delayed')}
              className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 active:opacity-80"
            >
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm font-bold text-red-600">{delayedCount} delayed</span>
            </button>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="px-4 lg:px-6 pt-5 lg:max-w-5xl lg:mx-auto lg:flex lg:gap-6">

        {/* ─── Left column: main content ─── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Summary cards — 2 per row, compact */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Total Work', value: totalCount,   bg: 'bg-blue-50',    num: 'text-blue-600',    sub: 'text-blue-500'    },
              { label: 'Delayed',    value: delayedCount, bg: 'bg-red-50',     num: 'text-red-600',     sub: 'text-red-500'     },
              { label: 'Started',    value: startedCount, bg: 'bg-amber-50',   num: 'text-amber-600',   sub: 'text-amber-500'   },
              { label: 'Done',       value: doneCount,    bg: 'bg-emerald-50', num: 'text-emerald-600', sub: 'text-emerald-500' },
            ].map(card => (
              <div key={card.label} className={`${card.bg} rounded-xl p-2.5 text-center`}>
                <p className={`text-2xl font-extrabold ${card.num}`}>{card.value}</p>
                <p className={`text-[11px] font-semibold mt-0.5 ${card.sub}`}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* ── Filter buttons ── */}
          <div className="space-y-2">
            {FILTERS.map(f => {
              const isActive        = filter === f.value
              const count           = getFilterCount(f.value, production)
              const isDelayedFilter = f.value === 'delayed'

              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors active:opacity-75
                    ${isActive
                      ? 'bg-blue-600 border-blue-600 shadow-md'
                      : isDelayedFilter && count > 0
                      ? 'bg-white border-red-200'
                      : 'bg-white border-slate-200'
                    }`}
                >
                  <span className="text-lg flex-shrink-0 w-6 text-center">{f.emoji}</span>
                  <span className={`text-sm font-semibold flex-1 ${
                    isActive ? 'text-white'
                    : isDelayedFilter && count > 0 ? 'text-red-700'
                    : 'text-slate-800'
                  }`}>
                    {f.label}
                  </span>
                  <span className={`text-xs font-bold min-w-[28px] text-center px-2 py-0.5 rounded-lg flex-shrink-0
                    ${isActive
                      ? 'bg-white/25 text-white'
                      : isDelayedFilter && count > 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Task list ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-800">{getSectionTitle(filter)}</h2>
              <span className="text-sm font-bold text-slate-400">
                {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500">No work in this stage</p>
                <p className="text-xs text-slate-400 mt-1">Tap a different stage above</p>
              </div>
            ) : (
              /* Task cards — always vertical, one per row */
              <div className="space-y-4">
                {filtered.map(item => (
                  <ProductionTaskCard
                    key={item.id}
                    item={item}
                    onUpdate={openSheet}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ─── Right summary panel — desktop only ─── */}
        <div className="hidden lg:flex lg:flex-col lg:w-80 lg:flex-shrink-0 gap-4">

          {/* Today summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
              <BarChart2 size={15} className="text-blue-600" />
              Today Summary
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Total Work Items', value: totalCount,   color: 'text-slate-800'   },
                { label: 'In Progress',      value: startedCount, color: 'text-amber-600'   },
                { label: 'Done Today',       value: doneCount,    color: 'text-emerald-600' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={`text-xl font-extrabold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Delayed alert */}
          {delayedCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-red-500" />
                <h3 className="text-sm font-extrabold text-red-700">Delayed Work</h3>
              </div>
              <p className="text-4xl font-extrabold text-red-600 mb-1">{delayedCount}</p>
              <p className="text-xs text-red-500 mb-4">
                item{delayedCount > 1 ? 's' : ''} need immediate attention
              </p>
              <button
                onClick={() => setFilter('delayed')}
                className="w-full bg-red-600 text-white rounded-xl py-3 text-sm font-bold active:bg-red-700"
              >
                View Delayed Work
              </button>
            </div>
          )}

          {/* Team working */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
              <Users size={15} className="text-blue-600" />
              Team Working
            </h3>
            <div className="space-y-3">
              {TEAM.map(name => (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-1">{name}</span>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">Active</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick action */}
          <button className="w-full bg-blue-600 text-white rounded-2xl py-4 text-base font-bold active:bg-blue-700 flex items-center justify-center gap-2">
            + Add Production Item
          </button>

        </div>
      </div>

      {/* Update stage bottom sheet */}
      <BottomSheet
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.projectName ?? ''}
        height="full"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${STAGE_COLOR[selected.stage]}`}>
                {selected.stage.replace('_', ' ')}
              </span>
              {selected.delayDays > 0 && (
                <span className="flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600">
                  <AlertTriangle size={11} /> {selected.delayDays}d delayed
                </span>
              )}
            </div>

            {/* Project details */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              {[
                { label: 'Project',  value: selected.projectName      },
                { label: 'Client',   value: selected.clientName       },
                { label: 'Product',  value: selected.productType      },
                { label: 'Manager',  value: selected.assignedManager  },
                { label: 'Delivery', value: selected.promisedDelivery },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-sm text-slate-400 font-medium">{label}</span>
                  <span className="text-sm font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>

            {/* Stage selection */}
            <PermissionGate permission="update_production">
              <div>
                <p className="text-sm font-bold text-slate-700 mb-3">Update Stage</p>
                <div className="space-y-2">
                  {STAGE_ORDER.map((s, i) => {
                    const stageIdx  = STAGE_ORDER.indexOf(selected.stage)
                    const isCurrent = s === selected.stage
                    const isPast    = i < stageIdx
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          updateProductionStage(selected.id, s, 'started')
                          setSelected(null)
                          setSnack({ open: true, msg: `Stage updated to ${s.replace('_', ' ')}!` })
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border text-sm font-bold capitalize active:scale-[0.98] transition-transform
                          ${isCurrent
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : isPast
                            ? 'bg-slate-50 border-slate-100 text-slate-400'
                            : 'bg-white border-slate-200 text-slate-700'
                          }`}
                      >
                        <span className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                          ${isCurrent ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 text-left">{s.replace('_', ' ')}</span>
                        {isCurrent && (
                          <span className="text-xs opacity-80 bg-white/20 px-2 py-0.5 rounded-lg">
                            Current
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mark as Done — requires production photo */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <FileUploadField
                  label="Production Photo"
                  required={isProductionTeam}
                  uploadedFiles={proofFiles}
                  onFileSelected={name => { setProofFiles([name]); setProofError(undefined) }}
                  error={proofError}
                />
                <button
                  onClick={handleMarkDone}
                  className="w-full bg-emerald-600 text-white rounded-xl py-4 text-base font-bold active:bg-emerald-700 min-h-[52px]"
                >
                  Work Done
                </button>
              </div>
            </PermissionGate>
          </div>
        )}
      </BottomSheet>

      <Snackbar
        isOpen={snack.open}
        message={snack.msg}
        type="success"
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      />
    </div>
  )
}
