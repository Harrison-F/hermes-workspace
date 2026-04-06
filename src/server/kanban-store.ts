/**
 * Kanban store — JSON file-based persistence at ~/.hermes/kanban/tasks.json
 *
 * Features:
 * - Mutex for file I/O serialization
 * - CAS versioning on task updates
 * - Atomic writes (write to .tmp then rename)
 * - Auto-create default board on first access
 */
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

// ─── Types ───────────────────────────────────────────────────────────

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low'
export type TaskActor = 'operator' | `agent:${string}`

export interface KanbanBoardConfig {
  columns: Array<{ key: TaskStatus; title: string; wipLimit?: number; visible: boolean }>
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

export type AgentStatus = 'idle' | 'working' | 'needs-input' | 'done' | 'error'

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
  feedback: Array<{ at: number; by: TaskActor; note: string }>
  sessionId?: string
  agentStatus?: AgentStatus
  agentSummary?: string
  spawnedFrom?: string
}

export interface KanbanData {
  boards: KanbanBoard[]
  tasks: KanbanTask[]
}

export interface TaskFilters {
  boardId?: string
  status?: TaskStatus
  priority?: TaskPriority[]
  q?: string
  limit?: number
  offset?: number
}

// ─── Constants ───────────────────────────────────────────────────────

const DATA_DIR = join(homedir(), '.hermes', 'kanban')
const DATA_FILE = join(DATA_DIR, 'tasks.json')

const DEFAULT_BOARD_CONFIG: KanbanBoardConfig = {
  columns: [
    { key: 'backlog', title: 'Backlog', visible: true },
    { key: 'todo', title: 'To Do', visible: true },
    { key: 'in-progress', title: 'In Progress', wipLimit: 5, visible: true },
    { key: 'review', title: 'Review', visible: true },
    { key: 'done', title: 'Done', visible: true },
    { key: 'cancelled', title: 'Cancelled', visible: false },
  ],
  defaults: { status: 'todo', priority: 'normal' },
  reviewRequired: false,
  allowDoneDragBypass: false,
  quickViewLimit: 50,
  proposalPolicy: 'confirm',
}

// ─── Mutex ───────────────────────────────────────────────────────────

class Mutex {
  private _queue: Array<() => void> = []
  private _locked = false

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const tryAcquire = () => {
        if (!this._locked) {
          this._locked = true
          resolve(() => {
            this._locked = false
            const next = this._queue.shift()
            if (next) next()
          })
        } else {
          this._queue.push(tryAcquire)
        }
      }
      tryAcquire()
    })
  }
}

const mutex = new Mutex()

// ─── File I/O ────────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readData(): Promise<KanbanData> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as KanbanData
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // First access — create default data and persist it
      const data = createDefaultData()
      await ensureDir()
      const tmpFile = DATA_FILE + '.tmp'
      await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8')
      await fs.rename(tmpFile, DATA_FILE)
      return data
    }
    throw err
  }
}

async function writeData(data: KanbanData): Promise<void> {
  await ensureDir()
  const tmpFile = DATA_FILE + '.tmp'
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmpFile, DATA_FILE)
}

function createDefaultData(): KanbanData {
  const now = Date.now()
  return {
    boards: [
      {
        id: randomUUID(),
        name: 'Default Board',
        order: 0,
        createdAt: now,
        updatedAt: now,
        config: { ...DEFAULT_BOARD_CONFIG },
      },
    ],
    tasks: [],
  }
}

/** Run a read-modify-write cycle under the mutex */
async function withData<T>(fn: (data: KanbanData) => T | Promise<T>): Promise<T> {
  const release = await mutex.acquire()
  try {
    const data = await readData()
    const result = await fn(data)
    await writeData(data)
    return result
  } finally {
    release()
  }
}

/** Read-only access under the mutex */
async function readOnly<T>(fn: (data: KanbanData) => T): Promise<T> {
  const release = await mutex.acquire()
  try {
    const data = await readData()
    return fn(data)
  } finally {
    release()
  }
}

// ─── Board Operations ────────────────────────────────────────────────

export async function listBoards(): Promise<KanbanBoard[]> {
  return readOnly((data) => {
    return [...data.boards].sort((a, b) => a.order - b.order)
  })
}

export async function createBoard(name: string, config?: Partial<KanbanBoardConfig>): Promise<KanbanBoard> {
  return withData((data) => {
    const now = Date.now()
    const maxOrder = data.boards.reduce((max, b) => Math.max(max, b.order), -1)
    const board: KanbanBoard = {
      id: randomUUID(),
      name,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      config: { ...DEFAULT_BOARD_CONFIG, ...config },
    }
    data.boards.push(board)
    return board
  })
}

export async function renameBoard(boardId: string, name: string): Promise<KanbanBoard> {
  return withData((data) => {
    const board = data.boards.find((b) => b.id === boardId)
    if (!board) throw new KanbanError('Board not found', 404)
    board.name = name
    board.updatedAt = Date.now()
    return board
  })
}

export async function deleteBoard(boardId: string): Promise<void> {
  return withData((data) => {
    const idx = data.boards.findIndex((b) => b.id === boardId)
    if (idx === -1) throw new KanbanError('Board not found', 404)
    data.boards.splice(idx, 1)
    // Remove all tasks belonging to the board
    data.tasks = data.tasks.filter((t) => t.boardId !== boardId)
  })
}

export async function reorderBoards(boardIds: string[]): Promise<KanbanBoard[]> {
  return withData((data) => {
    // Validate all IDs exist
    for (const id of boardIds) {
      if (!data.boards.find((b) => b.id === id)) {
        throw new KanbanError(`Board ${id} not found`, 404)
      }
    }
    const now = Date.now()
    for (let i = 0; i < boardIds.length; i++) {
      const board = data.boards.find((b) => b.id === boardIds[i])!
      board.order = i
      board.updatedAt = now
    }
    return [...data.boards].sort((a, b) => a.order - b.order)
  })
}

// ─── Task Operations ─────────────────────────────────────────────────

export async function listTasks(filters: TaskFilters = {}): Promise<{ tasks: KanbanTask[]; total: number }> {
  return readOnly((data) => {
    let tasks = [...data.tasks]

    if (filters.boardId) {
      tasks = tasks.filter((t) => t.boardId === filters.boardId)
    }
    if (filters.status) {
      tasks = tasks.filter((t) => t.status === filters.status)
    }
    if (filters.priority && filters.priority.length > 0) {
      tasks = tasks.filter((t) => filters.priority!.includes(t.priority))
    }
    if (filters.q) {
      const q = filters.q.toLowerCase()
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          t.labels.some((l) => l.toLowerCase().includes(q)),
      )
    }

    // Sort by columnOrder within status
    tasks.sort((a, b) => a.columnOrder - b.columnOrder)

    const total = tasks.length
    const offset = filters.offset ?? 0
    const limit = filters.limit ?? 100
    tasks = tasks.slice(offset, offset + limit)

    return { tasks, total }
  })
}

export interface CreateTaskInput {
  boardId: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  createdBy?: TaskActor
  assignee?: TaskActor
  labels?: string[]
}

export async function createTask(input: CreateTaskInput): Promise<KanbanTask> {
  return withData((data) => {
    const board = data.boards.find((b) => b.id === input.boardId)
    if (!board) throw new KanbanError('Board not found', 404)

    const now = Date.now()
    const status = input.status ?? board.config.defaults.status
    const priority = input.priority ?? board.config.defaults.priority

    // Calculate max columnOrder for the target status
    const maxOrder = data.tasks
      .filter((t) => t.boardId === input.boardId && t.status === status)
      .reduce((max, t) => Math.max(max, t.columnOrder), -1)

    const task: KanbanTask = {
      id: randomUUID(),
      boardId: input.boardId,
      title: input.title,
      description: input.description,
      status,
      priority,
      createdBy: input.createdBy ?? 'operator',
      createdAt: now,
      updatedAt: now,
      version: 1,
      assignee: input.assignee,
      labels: input.labels ?? [],
      columnOrder: maxOrder + 1,
      feedback: [],
    }
    data.tasks.push(task)
    return task
  })
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee?: TaskActor | null
  labels?: string[]
  version: number // Required for CAS
  sessionId?: string
  agentStatus?: AgentStatus
  agentSummary?: string
  spawnedFrom?: string
}

export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<KanbanTask> {
  return withData((data) => {
    const task = data.tasks.find((t) => t.id === taskId)
    if (!task) throw new KanbanError('Task not found', 404)

    // CAS check
    if (task.version !== input.version) {
      throw new KanbanError(
        `Version conflict: expected ${task.version}, got ${input.version}`,
        409,
      )
    }

    const now = Date.now()

    if (input.title !== undefined) task.title = input.title
    if (input.description !== undefined) task.description = input.description
    if (input.status !== undefined) {
      if (input.status !== task.status) {
        // Moving to a new status column — place at end
        const maxOrder = data.tasks
          .filter((t) => t.boardId === task.boardId && t.status === input.status && t.id !== taskId)
          .reduce((max, t) => Math.max(max, t.columnOrder), -1)
        task.columnOrder = maxOrder + 1
      }
      task.status = input.status
    }
    if (input.priority !== undefined) task.priority = input.priority
    if (input.assignee !== undefined) task.assignee = input.assignee ?? undefined
    if (input.labels !== undefined) task.labels = input.labels
    if (input.sessionId !== undefined) task.sessionId = input.sessionId
    if (input.agentStatus !== undefined) task.agentStatus = input.agentStatus
    if (input.agentSummary !== undefined) task.agentSummary = input.agentSummary
    if (input.spawnedFrom !== undefined) task.spawnedFrom = input.spawnedFrom

    task.updatedAt = now
    task.version += 1

    return task
  })
}

export async function deleteTask(taskId: string): Promise<void> {
  return withData((data) => {
    const idx = data.tasks.findIndex((t) => t.id === taskId)
    if (idx === -1) throw new KanbanError('Task not found', 404)
    data.tasks.splice(idx, 1)
  })
}

export interface ReorderTaskInput {
  targetStatus: TaskStatus
  targetIndex: number
  version: number
}

export async function reorderTask(taskId: string, input: ReorderTaskInput): Promise<KanbanTask> {
  return withData((data) => {
    const task = data.tasks.find((t) => t.id === taskId)
    if (!task) throw new KanbanError('Task not found', 404)

    // CAS check
    if (task.version !== input.version) {
      throw new KanbanError(
        `Version conflict: expected ${task.version}, got ${input.version}`,
        409,
      )
    }

    const now = Date.now()
    const oldStatus = task.status
    const newStatus = input.targetStatus

    // Get tasks in target column (excluding current task)
    const columnTasks = data.tasks
      .filter((t) => t.boardId === task.boardId && t.status === newStatus && t.id !== taskId)
      .sort((a, b) => a.columnOrder - b.columnOrder)

    // Insert at target index
    const targetIndex = Math.max(0, Math.min(input.targetIndex, columnTasks.length))

    // Reassign columnOrder for all tasks in the target column
    // Insert our task at the target position
    columnTasks.splice(targetIndex, 0, task)
    for (let i = 0; i < columnTasks.length; i++) {
      columnTasks[i].columnOrder = i
      if (columnTasks[i].id !== taskId) {
        columnTasks[i].updatedAt = now
      }
    }

    task.status = newStatus
    task.updatedAt = now
    task.version += 1

    // If moved from a different column, re-index the old column
    if (oldStatus !== newStatus) {
      const oldColumnTasks = data.tasks
        .filter((t) => t.boardId === task.boardId && t.status === oldStatus && t.id !== taskId)
        .sort((a, b) => a.columnOrder - b.columnOrder)
      for (let i = 0; i < oldColumnTasks.length; i++) {
        oldColumnTasks[i].columnOrder = i
      }
    }

    return task
  })
}

/** Get the current version of a task (for auto-version when not provided) */
export async function getTaskVersion(taskId: string): Promise<number> {
  return readOnly((data) => {
    const task = data.tasks.find((t) => t.id === taskId)
    if (!task) throw new KanbanError('Task not found', 404)
    return task.version
  })
}

// ─── Error helper ────────────────────────────────────────────────────

export class KanbanError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'KanbanError'
  }
}

// ─── Init helper (ensure data file exists) ──────────────────────────

export async function ensureKanbanStore(): Promise<void> {
  const release = await mutex.acquire()
  try {
    await ensureDir()
    try {
      await fs.access(DATA_FILE)
    } catch {
      const data = createDefaultData()
      const tmpFile = DATA_FILE + '.tmp'
      await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8')
      await fs.rename(tmpFile, DATA_FILE)
    }
  } finally {
    release()
  }
}
