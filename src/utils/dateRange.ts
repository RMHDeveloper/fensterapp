export type DateFilter = 'today' | 'week' | 'month' | 'custom'

export const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom',label: 'Custom' },
]

export function getDateRange(filter: DateFilter, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (filter === 'today') return { from: todayStart, to: todayEnd }
  if (filter === 'week') {
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const weekStart = new Date(todayStart)
    weekStart.setDate(todayStart.getDate() - diff)
    return { from: weekStart, to: todayEnd }
  }
  if (filter === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: todayEnd }
  }
  const from = customFrom ? new Date(customFrom + 'T00:00:00') : todayStart
  const to   = customTo   ? new Date(customTo   + 'T23:59:59') : todayEnd
  return { from, to }
}

export function parseFlexDate(dateStr: string): Date {
  // ISO: YYYY-MM-DD or YYYY-MM-DDTHH:...
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr)
  // en-IN locale: D/M/YYYY (day first)
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number)
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d)
  }
  return new Date(dateStr)
}

export function inRange(dateStr: string | undefined, from: Date, to: Date): boolean {
  if (!dateStr) return false
  const d = parseFlexDate(dateStr)
  return !isNaN(d.getTime()) && d >= from && d <= to
}

export function leadDate(l: { createdAt?: string; lastContact?: string }): string | undefined {
  return l.createdAt || l.lastContact
}
