import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  KanbanBoard,
  KanbanBoardConfig,
  KanbanTask,
  TaskVisibility,
  TaskStatus,
} from '../types'

const STORAGE_KEY = 'hermes-kanban-active-board'
const POLL_INTERVAL = 5000

// --- API helpers ---

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

// --- Boards ---

async function fetchBoards(): Promise<KanbanBoard[]> {
  return apiFetch<KanbanBoard[]>('/api/kanban-boards')
}

async function createBoard(
  name: string,
  config?: Partial<KanbanBoardConfig>,
): Promise<KanbanBoard> {
  return apiFetch<KanbanBoard>('/api/kanban-boards', {
    method: 'POST',
    body: JSON.stringify({ name, config }),
  })
}

async function updateBoard(
  id: string,
  patch: Partial<Pick<KanbanBoard, 'name' | 'order' | 'config'>>,
): Promise<KanbanBoard> {
  return apiFetch<KanbanBoard>(`/api/kanban-boards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

async function deleteBoard(id: string): Promise<void> {
  return apiFetch<void>(`/api/kanban-boards/${id}`, { method: 'DELETE' })
}

// --- Tasks ---

async function fetchTasks(boardId: string): Promise<KanbanTask[]> {
  return apiFetch<KanbanTask[]>(`/api/kanban-tasks?boardId=${boardId}`)
}

async function createTask(
  data: Pick<KanbanTask, 'boardId' | 'title' | 'description' | 'status' | 'visibility'> & {
    labels?: string[]
  },
): Promise<KanbanTask> {
  return apiFetch<KanbanTask>('/api/kanban-tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

async function updateTask(
  id: string,
  patch: Partial<
    Pick<
      KanbanTask,
      | 'title'
      | 'description'
      | 'status'
      | 'visibility'
      | 'assignee'
      | 'labels'
      | 'columnOrder'
      | 'dueAt'
      | 'sessionId'
      | 'agentStatus'
      | 'agentSummary'
      | 'spawnedFrom'
      | 'comment'
    >
  > & { version: number },
): Promise<KanbanTask> {
  return apiFetch<KanbanTask>(`/api/kanban-tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

async function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/api/kanban-tasks/${id}`, { method: 'DELETE' })
}

async function reorderTask(
  id: string,
  status: TaskStatus,
  columnOrder: number,
  version: number,
): Promise<KanbanTask> {
  return apiFetch<KanbanTask>(`/api/kanban-tasks/${id}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ status, columnOrder, version }),
  })
}

// --- Filters ---

export interface KanbanFilters {
  search: string
  statuses: TaskStatus[]
  visibilities: TaskVisibility[]
  labels: string[]
}

const emptyFilters: KanbanFilters = {
  search: '',
  statuses: [],
  visibilities: [],
  labels: [],
}

function matchesFilters(task: KanbanTask, filters: KanbanFilters): boolean {
  if (
    filters.search &&
    !task.title.toLowerCase().includes(filters.search.toLowerCase()) &&
    !(task.description ?? '').toLowerCase().includes(filters.search.toLowerCase())
  ) {
    return false
  }
  if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
    return false
  }
  if (filters.visibilities.length > 0 && !filters.visibilities.includes(task.visibility)) {
    return false
  }
  if (filters.labels.length > 0 && !filters.labels.some((l) => task.labels.includes(l))) {
    return false
  }
  return true
}

// --- Hook ---

export interface UseKanbanReturn {
  // Boards
  boards: KanbanBoard[]
  activeBoardId: string | null
  setActiveBoardId: (id: string | null) => void
  createBoard: (name: string, config?: Partial<KanbanBoardConfig>) => Promise<void>
  updateBoard: (
    id: string,
    patch: Partial<Pick<KanbanBoard, 'name' | 'order' | 'config'>>,
  ) => Promise<void>
  deleteBoard: (id: string) => Promise<void>
  // Tasks
  tasks: KanbanTask[]
  filteredTasks: KanbanTask[]
  createTask: (
    data: Pick<KanbanTask, 'boardId' | 'title' | 'description' | 'status' | 'visibility'> & {
      labels?: string[]
    },
  ) => Promise<void>
  updateTask: (
    id: string,
    patch: Partial<
      Pick<
        KanbanTask,
        | 'title'
        | 'description'
        | 'status'
        | 'visibility'
        | 'assignee'
        | 'labels'
        | 'columnOrder'
        | 'dueAt'
        | 'sessionId'
        | 'agentStatus'
        | 'agentSummary'
        | 'spawnedFrom'
        | 'comment'
      >
    >,
  ) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  reorderTask: (id: string, status: TaskStatus, columnOrder: number) => Promise<void>
  // Filters
  filters: KanbanFilters
  setFilters: React.Dispatch<React.SetStateAction<KanbanFilters>>
  resetFilters: () => void
  // State
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useKanban(): UseKanbanReturn {
  const [boards, setBoards] = useState<KanbanBoard[]>([])
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [activeBoardId, setActiveBoardIdRaw] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null
    } catch {
      return null
    }
  })
  const [filters, setFilters] = useState<KanbanFilters>(emptyFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setActiveBoardId = useCallback((id: string | null) => {
    setActiveBoardIdRaw(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const loadBoards = useCallback(async () => {
    try {
      const data = await fetchBoards()
      setBoards(data)
      return data
    } catch (e) {
      setError((e as Error).message)
      return []
    }
  }, [])

  const loadTasks = useCallback(
    async (boardId: string) => {
      try {
        const data = await fetchTasks(boardId)
        setTasks(data)
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [],
  )

  const refresh = useCallback(async () => {
    const data = await loadBoards()
    if (activeBoardId) {
      await loadTasks(activeBoardId)
    } else if (data.length > 0) {
      setActiveBoardId(data[0].id)
      await loadTasks(data[0].id)
    }
  }, [activeBoardId, loadBoards, loadTasks, setActiveBoardId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    loadBoards()
      .then((data) => {
        if (activeBoardId) {
          return loadTasks(activeBoardId)
        }
        if (data.length > 0) {
          setActiveBoardId(data[0].id)
          return loadTasks(data[0].id)
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload tasks when board changes
  useEffect(() => {
    if (activeBoardId) {
      loadTasks(activeBoardId)
    } else {
      setTasks([])
    }
  }, [activeBoardId, loadTasks])

  // Polling
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!activeBoardId) return
    pollRef.current = setInterval(() => {
      loadTasks(activeBoardId)
    }, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeBoardId, loadTasks])

  const filteredTasks = tasks.filter((t) => matchesFilters(t, filters))

  const handleCreateBoard = useCallback(
    async (name: string, config?: Partial<KanbanBoardConfig>) => {
      const board = await createBoard(name, config)
      setBoards((prev) => [...prev, board])
      setActiveBoardId(board.id)
    },
    [setActiveBoardId],
  )

  const handleUpdateBoard = useCallback(
    async (
      id: string,
      patch: Partial<Pick<KanbanBoard, 'name' | 'order' | 'config'>>,
    ) => {
      const updated = await updateBoard(id, patch)
      setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)))
    },
    [],
  )

  const handleDeleteBoard = useCallback(
    async (id: string) => {
      await deleteBoard(id)
      setBoards((prev) => prev.filter((b) => b.id !== id))
      if (activeBoardId === id) {
        const remaining = boards.filter((b) => b.id !== id)
        setActiveBoardId(remaining.length > 0 ? remaining[0].id : null)
      }
    },
    [activeBoardId, boards, setActiveBoardId],
  )

  const handleCreateTask = useCallback(
    async (
      data: Pick<KanbanTask, 'boardId' | 'title' | 'description' | 'status' | 'visibility'> & {
        labels?: string[]
      },
    ) => {
      const task = await createTask(data)
      setTasks((prev) => [...prev, task])
    },
    [],
  )

  const handleUpdateTask = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          KanbanTask,
          | 'title'
          | 'description'
          | 'status'
          | 'visibility'
          | 'assignee'
          | 'labels'
          | 'columnOrder'
          | 'dueAt'
          | 'sessionId'
          | 'agentStatus'
          | 'agentSummary'
          | 'spawnedFrom'
          | 'comment'
        >
      >,
    ) => {
      const currentTask = tasks.find((task) => task.id === id)
      if (!currentTask) throw new Error(`Task not found: ${id}`)
      const updated = await updateTask(id, { ...patch, version: currentTask.version })
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
    },
    [tasks],
  )

  const handleDeleteTask = useCallback(async (id: string) => {
    await deleteTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleReorderTask = useCallback(
    async (id: string, status: TaskStatus, columnOrder: number) => {
      const currentTask = tasks.find((task) => task.id === id)
      if (!currentTask) throw new Error(`Task not found: ${id}`)

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status, columnOrder } : t)),
      )
      try {
        const updated = await reorderTask(id, status, columnOrder, currentTask.version)
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      } catch {
        // Revert on error — reload
        if (activeBoardId) loadTasks(activeBoardId)
      }
    },
    [activeBoardId, loadTasks, tasks],
  )

  const resetFilters = useCallback(() => setFilters(emptyFilters), [])

  return {
    boards,
    activeBoardId,
    setActiveBoardId,
    createBoard: handleCreateBoard,
    updateBoard: handleUpdateBoard,
    deleteBoard: handleDeleteBoard,
    tasks,
    filteredTasks,
    createTask: handleCreateTask,
    updateTask: handleUpdateTask,
    deleteTask: handleDeleteTask,
    reorderTask: handleReorderTask,
    filters,
    setFilters,
    resetFilters,
    loading,
    error,
    refresh,
  }
}
