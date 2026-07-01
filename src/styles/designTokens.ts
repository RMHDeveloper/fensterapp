// Design Tokens — Fenster Operations
// All visual constants for consistent UI across screens

export const colors = {
  primary:   { main: '#0B7A3B', light: '#ECFDF3', dark: '#065F2D' },
  accent:    { main: '#9DCD3A', light: '#F1F8E9', dark: '#7DBE31' },
  success:   { main: '#10B981', light: '#D1FAE5', dark: '#059669' },
  warning:   { main: '#F59E0B', light: '#FEF3C7', dark: '#D97706' },
  error:     { main: '#EF4444', light: '#FEE2E2', dark: '#DC2626' },
  info:      { main: '#3B82F6', light: '#DBEAFE', dark: '#2563EB' },
  bg:        '#F8FAFC',
  card:      '#FFFFFF',
  border:    '#E2E8F0',
  textPrimary:  '#1E293B',
  textSecondary:'#64748B',
  textMuted:    '#94A3B8',
}

export const taskStatusColors: Record<string, { bg: string; text: string; dot: string }> = {
  pending:     { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-400'  },
  in_progress: { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500'   },
  completed:   { bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-500'},
  overdue:     { bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500'    },
}

export const priorityColors: Record<string, { bg: string; text: string; ring: string }> = {
  low:      { bg: 'bg-slate-100',   text: 'text-slate-600',  ring: 'border-slate-300' },
  medium:   { bg: 'bg-amber-50',    text: 'text-amber-700',  ring: 'border-amber-300' },
  high:     { bg: 'bg-orange-50',   text: 'text-orange-700', ring: 'border-orange-400'},
  critical: { bg: 'bg-red-50',      text: 'text-red-700',    ring: 'border-red-500'   },
}

export const projectStatusColors: Record<string, { bg: string; text: string }> = {
  new:       { bg: 'bg-blue-50',    text: 'text-blue-700'   },
  active:    { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  on_hold:   { bg: 'bg-amber-50',   text: 'text-amber-700'  },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700'},
  cancelled: { bg: 'bg-red-50',     text: 'text-red-700'    },
}

export const paymentStatusColors: Record<string, { bg: string; text: string }> = {
  pending:  { bg: 'bg-slate-100',   text: 'text-slate-600'  },
  partial:  { bg: 'bg-amber-50',    text: 'text-amber-700'  },
  paid:     { bg: 'bg-emerald-50',  text: 'text-emerald-700'},
  overdue:  { bg: 'bg-red-50',      text: 'text-red-700'    },
}

export const quotationStatusColors: Record<string, { bg: string; text: string }> = {
  draft:            { bg: 'bg-slate-100',   text: 'text-slate-600'  },
  waiting_approval: { bg: 'bg-amber-50',    text: 'text-amber-700'  },
  sent_to_client:   { bg: 'bg-blue-50',     text: 'text-blue-700'   },
  approved:         { bg: 'bg-emerald-50',  text: 'text-emerald-700'},
  rejected:         { bg: 'bg-red-50',      text: 'text-red-700'    },
  converted:        { bg: 'bg-indigo-50',   text: 'text-indigo-700' },
  lost:             { bg: 'bg-slate-100',   text: 'text-slate-500'  },
}

export const productionStageColors: Record<string, { bg: string; text: string }> = {
  cutting:        { bg: 'bg-blue-50',    text: 'text-blue-700'   },
  routing:        { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  welding:        { bg: 'bg-violet-50',  text: 'text-violet-700' },
  assembly:       { bg: 'bg-amber-50',   text: 'text-amber-700'  },
  glazing:        { bg: 'bg-orange-50',  text: 'text-orange-700' },
  packing:        { bg: 'bg-rose-50',    text: 'text-rose-700'   },
  dispatch_ready: { bg: 'bg-teal-50',    text: 'text-teal-700'   },
}

export const mistakeStatusColors: Record<string, { bg: string; text: string }> = {
  open:        { bg: 'bg-red-50',     text: 'text-red-700'    },
  in_progress: { bg: 'bg-blue-50',    text: 'text-blue-700'   },
  rework:      { bg: 'bg-amber-50',   text: 'text-amber-700'  },
  resolved:    { bg: 'bg-emerald-50', text: 'text-emerald-700'},
}

export const typography = {
  title:    'text-lg font-bold text-slate-800',
  heading:  'text-base font-semibold text-slate-800',
  subhead:  'text-sm font-semibold text-slate-700',
  body:     'text-sm text-slate-700',
  caption:  'text-xs text-slate-500',
  tiny:     'text-[11px] text-slate-400',
  label:    'text-xs font-medium text-slate-500',
}

export const spacing = {
  screen:  'px-4',
  card:    'p-4',
  cardSm:  'p-3',
  section: 'mb-5',
  gap:     'gap-3',
}

export const radius = {
  card: 'rounded-2xl',
  btn:  'rounded-xl',
  badge:'rounded-full',
  input:'rounded-xl',
}

export const shadows = {
  card:  'shadow-card',
  nav:   'shadow-nav',
  fab:   'shadow-fab',
  sheet: 'shadow-sheet',
}
