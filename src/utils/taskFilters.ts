import type { Task } from '../types'

export function isSameLocalDate(a: string | undefined | null, b: string): boolean {
  if (!a) return false
  if (a === 'Today') return true    // legacy string tasks always count as today
  return a.slice(0, 10) === b.slice(0, 10)
}

function localTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isTaskForToday(task: Task): boolean {
  const today = localTodayStr()
  return (
    isSameLocalDate(task.dueDate,         today) ||
    isSameLocalDate(task.visitDate,       today) ||
    isSameLocalDate(task.rescheduleDate,  today)
  )
}

export function isDateToday(d: string | undefined | null): boolean {
  return isSameLocalDate(d, localTodayStr())
}

export function isDateFuture(d: string | undefined | null): boolean {
  if (!d || d === 'Today' || d === '—') return false
  return d.slice(0, 10) > localTodayStr()
}
