import type { TaskPriority, TaskStatus } from './types'

/**
 * Tone helpers — maps task statuses and priorities to Tailwind color classes.
 * Uses standard Tailwind classes compatible with Hermes theme (CSS variable based).
 */

// --- Status colors ---
const STATUS_TEXT: Record<TaskStatus, string> = {
  backlog: 'text-gray-500',
  todo: 'text-blue-500',
  'in-progress': 'text-orange-500',
  review: 'text-purple-500',
  done: 'text-emerald-500',
  cancelled: 'text-red-500',
}

const STATUS_BG: Record<TaskStatus, string> = {
  backlog: 'bg-gray-500/10',
  todo: 'bg-blue-500/10',
  'in-progress': 'bg-orange-500/10',
  review: 'bg-purple-500/10',
  done: 'bg-emerald-500/10',
  cancelled: 'bg-red-500/10',
}

const STATUS_BORDER: Record<TaskStatus, string> = {
  backlog: 'border-gray-500/30',
  todo: 'border-blue-500/30',
  'in-progress': 'border-orange-500/30',
  review: 'border-purple-500/30',
  done: 'border-emerald-500/30',
  cancelled: 'border-red-500/30',
}

// --- Priority colors ---
const PRIORITY_TEXT: Record<TaskPriority, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  normal: 'text-blue-500',
  low: 'text-gray-500',
}

const PRIORITY_BG: Record<TaskPriority, string> = {
  critical: 'bg-red-500/10',
  high: 'bg-orange-500/10',
  normal: 'bg-blue-500/10',
  low: 'bg-gray-500/10',
}

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  critical: 'border-red-500/30',
  high: 'border-orange-500/30',
  normal: 'border-blue-500/30',
  low: 'border-gray-500/30',
}

export function statusTextClass(status: TaskStatus): string {
  return STATUS_TEXT[status] ?? 'text-gray-500'
}

export function statusBgClass(status: TaskStatus): string {
  return STATUS_BG[status] ?? 'bg-gray-500/10'
}

export function statusBorderClass(status: TaskStatus): string {
  return STATUS_BORDER[status] ?? 'border-gray-500/30'
}

export function priorityTextClass(priority: TaskPriority): string {
  return PRIORITY_TEXT[priority] ?? 'text-gray-500'
}

export function priorityBgClass(priority: TaskPriority): string {
  return PRIORITY_BG[priority] ?? 'bg-gray-500/10'
}

export function priorityBorderClass(priority: TaskPriority): string {
  return PRIORITY_BORDER[priority] ?? 'border-gray-500/30'
}

/** Combined pill classes for a status badge */
export function statusPillClasses(status: TaskStatus): string {
  return `${STATUS_TEXT[status]} ${STATUS_BG[status]} ${STATUS_BORDER[status]}`
}

/** Combined pill classes for a priority badge */
export function priorityPillClasses(priority: TaskPriority): string {
  return `${PRIORITY_TEXT[priority]} ${PRIORITY_BG[priority]} ${PRIORITY_BORDER[priority]}`
}
