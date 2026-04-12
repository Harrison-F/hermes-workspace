import type { TaskStatus, TaskVisibility } from './types'

/**
 * Tone helpers — maps task statuses and visibility states to Tailwind color classes.
 * Uses standard Tailwind classes compatible with Hermes theme (CSS variable based).
 */

// --- Status colors ---
const STATUS_TEXT: Record<TaskStatus, string> = {
  backlog: 'text-gray-500',
  todo: 'text-blue-500',
  'in-progress': 'text-orange-500',
  review: 'text-purple-500',
  blocked: 'text-amber-500',
  done: 'text-emerald-500',
  cancelled: 'text-red-500',
}

const STATUS_BG: Record<TaskStatus, string> = {
  backlog: 'bg-gray-500/10',
  todo: 'bg-blue-500/10',
  'in-progress': 'bg-orange-500/10',
  review: 'bg-purple-500/10',
  blocked: 'bg-amber-500/10',
  done: 'bg-emerald-500/10',
  cancelled: 'bg-red-500/10',
}

const STATUS_BORDER: Record<TaskStatus, string> = {
  backlog: 'border-gray-500/30',
  todo: 'border-blue-500/30',
  'in-progress': 'border-orange-500/30',
  review: 'border-purple-500/30',
  blocked: 'border-amber-500/30',
  done: 'border-emerald-500/30',
  cancelled: 'border-red-500/30',
}

// --- Visibility colors ---
const VISIBILITY_TEXT: Record<TaskVisibility, string> = {
  yes: 'text-blue-500',
  somewhat: 'text-orange-500',
  no: 'text-gray-500',
}

const VISIBILITY_BG: Record<TaskVisibility, string> = {
  yes: 'bg-blue-500/10',
  somewhat: 'bg-orange-500/10',
  no: 'bg-gray-500/10',
}

const VISIBILITY_BORDER: Record<TaskVisibility, string> = {
  yes: 'border-blue-500/30',
  somewhat: 'border-orange-500/30',
  no: 'border-gray-500/30',
}

export const CARD_VISIBILITY_OUTLINE: Record<TaskVisibility, string> = {
  yes: 'border-blue-500/70',
  somewhat: 'border-orange-500/70',
  no: 'border-transparent',
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

export function visibilityTextClass(visibility: TaskVisibility): string {
  return VISIBILITY_TEXT[visibility] ?? 'text-gray-500'
}

export function visibilityBgClass(visibility: TaskVisibility): string {
  return VISIBILITY_BG[visibility] ?? 'bg-gray-500/10'
}

export function visibilityBorderClass(visibility: TaskVisibility): string {
  return VISIBILITY_BORDER[visibility] ?? 'border-gray-500/30'
}

/** Combined pill classes for a status badge */
export function statusPillClasses(status: TaskStatus): string {
  return `${STATUS_TEXT[status]} ${STATUS_BG[status]} ${STATUS_BORDER[status]}`
}

/** Combined pill classes for a visibility badge */
export function visibilityPillClasses(visibility: TaskVisibility): string {
  return `${VISIBILITY_TEXT[visibility]} ${VISIBILITY_BG[visibility]} ${VISIBILITY_BORDER[visibility]}`
}
