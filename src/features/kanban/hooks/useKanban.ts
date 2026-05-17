import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  KanbanBoard,
  KanbanBoardConfig,
  KanbanTask,
  TaskVisibility,
  TaskStatus,
} from '../types'

const STORAGE_KEY = 'hermes-kanban-active-board'
const ACTIVE_BOARD_COOKIE = 'hermes-kanban-active-board'
const OPENING_CONVON_BOARD_COOKIE = 'hermes-opening-convon-board'
const BOARDS_CACHE_KEY = 'hermes-kanban-boards-cache-v1'
const TASKS_CACHE_PREFIX = 'hermes-kanban-tasks-cache-v1:'
const ACTIVE_BOARD_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const POLL_INTERVAL = 5000

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore cache failures
  }
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore cache failures
  }
}

function readCachedBoards(): KanbanBoard[] {
  const cached = readStorage<KanbanBoard[]>(BOARDS_CACHE_KEY)
  return Array.isArray(cached) ? cached : []
}

function writeCachedBoards(boards: KanbanBoard[]) {
  writeStorage(BOARDS_CACHE_KEY, boards)
}

function readCachedTasks(boardId: string | null): KanbanTask[] {
  if (!boardId) return []
  const cached = readStorage<KanbanTask[]>(`${TASKS_CACHE_PREFIX}${boardId}`)
  return Array.isArray(cached) ? cached : []
}

function writeCachedTasks(boardId: string, tasks: KanbanTask[]) {
  writeStorage(`${TASKS_CACHE_PREFIX}${boardId}`, tasks)
}

function clearCachedTasks(boardId: string) {
  removeStorage(`${TASKS_CACHE_PREFIX}${boardId}`)
}

function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const target = `${name}=`
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
  return match ? decodeURIComponent(match.slice(target.length)) : null
}

function writeActiveBoardCookie(id: string | null) {
  if (typeof document === 'undefined') return
  if (!id) {
    document.cookie = `${ACTIVE_BOARD_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    return
  }
  document.cookie = `${ACTIVE_BOARD_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${ACTIVE_BOARD_COOKIE_MAX_AGE}; SameSite=Lax`
}

export interface KanbanInitialData {
  boards: KanbanBoard[]
  activeBoardId: string | null
  tasks: KanbanTask[]
}

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

interface UseKanbanOptions {
  initialData?: KanbanInitialData | null
}

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

export function useKanban({ initialData = null }: UseKanbanOptions = {}): UseKanbanReturn {
  const initialBoardId =
    initialData?.activeBoardId ??
    (() => {
      try {
        return (
          localStorage.getItem(STORAGE_KEY) ||
          readCookieValue(ACTIVE_BOARD_COOKIE) ||
          readCookieValue(OPENING_CONVON_BOARD_COOKIE) ||
          null
        )
      } catch {
        return (
          readCookieValue(OPENING_CONVON_BOARD_COOKIE) ||
          readCookieValue(ACTIVE_BOARD_COOKIE) ||
          null
        )
      }
    })()

  const [activeBoardId, setActiveBoardIdRaw] = useState<string | null>(initialBoardId)
  const [boards, setBoards] = useState<KanbanBoard[]>(() => initialData?.boards ?? readCachedBoards())
  const [tasks, setTasks] = useState<KanbanTask[]>(() =>
    initialData?.tasks ?? readCachedTasks(initialBoardId),
  )
  const [filters, setFilters] = useState<KanbanFilters>(emptyFilters)
  const [loading, setLoading] = useState(() => {
    if (initialData) return false
    return readCachedBoards().length === 0 && readCachedTasks(initialBoardId).length === 0
  })
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setActiveBoardId = useCallback((id: string | null) => {
    setActiveBoardIdRaw(id)

    if (id) {
      setTasks(readCachedTasks(id))
      setLoading(false)
    } else {
      setTasks([])
    }

    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    writeActiveBoardCookie(id)
  }, [])

  const loadBoards = useCallback(async () => {
    try {
      const data = await fetchBoards()
      setBoards(data)
      writeCachedBoards(data)

      if (activeBoardId && !data.some((board) => board.id === activeBoardId)) {
        clearCachedTasks(activeBoardId)
      }

      return data
    } catch (e) {
      setError((e as Error).message)
      return []
    }
  }, [activeBoardId])

  const loadTasks = useCallback(
    async (boardId: string) => {
      try {
        const data = await fetchTasks(boardId)
        setTasks(data)
        writeCachedTasks(boardId, data)
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

  useEffect(() => {
    if (!initialData) return
    writeCachedBoards(initialData.boards)
    if (initialData.activeBoardId) {
      writeCachedTasks(initialData.activeBoardId, initialData.tasks)
      try {
        localStorage.setItem(STORAGE_KEY, initialData.activeBoardId)
      } catch {
        // ignore
      }
    }
    writeActiveBoardCookie(initialData.activeBoardId)
  }, [initialData])

  // Initial/background load
  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      setLoading(!initialData && boards.length === 0 && tasks.length === 0)

      const rememberedBoardId = activeBoardId
      const boardsPromise = loadBoards()
      const tasksPromise = rememberedBoardId ? loadTasks(rememberedBoardId) : Promise.resolve()

      const [loadedBoards] = await Promise.all([boardsPromise, tasksPromise])
      if (cancelled) return

      const resolvedBoard = rememberedBoardId
        ? loadedBoards.find((board) => board.id === rememberedBoardId) ?? null
        : null

      if (resolvedBoard) {
        if (resolvedBoard.id !== activeBoardId) {
          setActiveBoardId(resolvedBoard.id)
        }
      } else if (loadedBoards.length > 0) {
        const fallbackBoardId = loadedBoards[0].id
        if (fallbackBoardId !== rememberedBoardId) {
          setActiveBoardId(fallbackBoardId)
          await loadTasks(fallbackBoardId)
        }
      } else {
        setActiveBoardId(null)
        setTasks([])
      }

      if (!cancelled) {
        setLoading(false)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
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
      setBoards((prev) => {
        const next = [...prev, board]
        writeCachedBoards(next)
        return next
      })
      writeCachedTasks(board.id, [])
      setTasks([])
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
      setBoards((prev) => {
        const next = prev.map((b) => (b.id === id ? updated : b))
        writeCachedBoards(next)
        return next
      })
    },
    [],
  )

  const handleDeleteBoard = useCallback(
    async (id: string) => {
      await deleteBoard(id)
      clearCachedTasks(id)
      setBoards((prev) => {
        const remaining = prev.filter((b) => b.id !== id)
        writeCachedBoards(remaining)
        return remaining
      })
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
      setTasks((prev) => {
        const next = [...prev, task]
        writeCachedTasks(task.boardId, next)
        return next
      })
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
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === id ? updated : t))
        writeCachedTasks(updated.boardId, next)
        return next
      })
    },
    [tasks],
  )

  const handleDeleteTask = useCallback(async (id: string) => {
    await deleteTask(id)
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (activeBoardId) {
        writeCachedTasks(activeBoardId, next)
      }
      return next
    })
  }, [activeBoardId])

  const handleReorderTask = useCallback(
    async (id: string, status: TaskStatus, columnOrder: number) => {
      const currentTask = tasks.find((task) => task.id === id)
      if (!currentTask) throw new Error(`Task not found: ${id}`)

      // Optimistic update
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, status, columnOrder } : t))
        if (activeBoardId) {
          writeCachedTasks(activeBoardId, next)
        }
        return next
      })
      try {
        const updated = await reorderTask(id, status, columnOrder, currentTask.version)
        setTasks((prev) => {
          const next = prev.map((t) => (t.id === id ? updated : t))
          writeCachedTasks(updated.boardId, next)
          return next
        })
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
