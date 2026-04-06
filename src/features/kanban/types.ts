export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low'
export const COLUMNS: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'review', 'done']
export const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
}
export type TaskActor = 'operator' | `agent:${string}`
export interface KanbanBoardConfig {
  columns: Array<{
    key: TaskStatus
    title: string
    wipLimit?: number
    visible: boolean
  }>
  defaults: { status: TaskStatus; priority: TaskPriority }
  reviewRequired: boolean
  allowDoneDragBypass: boolean
  quickViewLimit: number
  proposalPolicy: 'confirm' | 'auto'
}
export interface KanbanBoard {
  id: string
  name: string
  order: number
  createdAt: number
  updatedAt: number
  config: KanbanBoardConfig
}
export interface TaskFeedback {
  at: number
  by: TaskActor
  note: string
}
export interface KanbanTask {
  id: string
  boardId: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  createdBy: TaskActor
  createdAt: number
  updatedAt: number
  version: number
  assignee?: TaskActor
  labels: string[]
  columnOrder: number
  dueAt?: number
  feedback: TaskFeedback[]
}
