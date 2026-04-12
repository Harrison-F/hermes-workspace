export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'blocked' | 'done' | 'cancelled'
export type TaskVisibility = 'yes' | 'no' | 'somewhat'
export const COLUMNS: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'review', 'blocked', 'done']
export const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
}
export const VISIBILITY_LABELS: Record<TaskVisibility, string> = {
  yes: 'Yes',
  no: 'No',
  somewhat: 'Somewhat',
}
export type TaskActor = 'operator' | `agent:${string}`
export interface KanbanBoardConfig {
  columns: Array<{
    key: TaskStatus
    title: string
    wipLimit?: number
    visible: boolean
  }>
  defaults: { status: TaskStatus; visibility: TaskVisibility }
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
export type AgentStatus = 'idle' | 'working' | 'needs-input' | 'done' | 'error'

export interface KanbanTask {
  comment?: string
  id: string
  boardId: string
  title: string
  description?: string
  status: TaskStatus
  visibility: TaskVisibility
  createdBy: TaskActor
  createdAt: number
  updatedAt: number
  version: number
  assignee?: TaskActor
  labels: string[]
  columnOrder: number
  dueAt?: number | null
  feedback: TaskFeedback[]
  sessionId?: string
  agentStatus?: AgentStatus
  agentSummary?: string
  spawnedFrom?: string
}
