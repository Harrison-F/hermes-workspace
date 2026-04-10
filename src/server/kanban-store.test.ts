import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('kanban store board updates', () => {
  it('creates tasks with the default visibility value', async () => {
    const home = await mkdtemp(join(tmpdir(), 'kanban-store-test-'))
    vi.stubEnv('HOME', home)

    const store = await import('./kanban-store')
    const [board] = await store.listBoards()
    const task = await store.createTask({
      boardId: board.id,
      title: 'Visibility defaults',
    })

    expect(task.visibility).toBe('no')
  })

  it('appends comments, persists complete-by dates, and clears them', async () => {
    const home = await mkdtemp(join(tmpdir(), 'kanban-store-test-'))
    vi.stubEnv('HOME', home)

    const store = await import('./kanban-store')
    const [board] = await store.listBoards()
    const task = await store.createTask({
      boardId: board.id,
      title: 'Needs follow-up',
    })

    const dueAt = Date.UTC(2026, 3, 15, 12, 0)
    const updated = await store.updateTask(task.id, {
      version: task.version,
      dueAt,
      comment: 'Waiting on copy edits.',
    })

    expect(updated.dueAt).toBe(dueAt)
    expect(updated.feedback.at(-1)?.note).toBe('Waiting on copy edits.')

    const raw = await readFile(join(home, '.hermes', 'kanban', 'tasks.json'), 'utf-8')
    const data = JSON.parse(raw) as {
      tasks: Array<{ id: string; dueAt?: number; feedback: Array<{ note: string }> }>
    }

    const savedTask = data.tasks.find((saved) => saved.id === task.id)
    expect(savedTask?.dueAt).toBe(dueAt)
    expect(savedTask?.feedback.at(-1)?.note).toBe('Waiting on copy edits.')

    const cleared = await store.updateTask(task.id, {
      version: updated.version,
      dueAt: null,
    })

    expect(cleared.dueAt).toBeUndefined()

    const rawAfterClear = await readFile(join(home, '.hermes', 'kanban', 'tasks.json'), 'utf-8')
    const dataAfterClear = JSON.parse(rawAfterClear) as {
      tasks: Array<{ id: string; dueAt?: number | null }>
    }

    const clearedTask = dataAfterClear.tasks.find((saved) => saved.id === task.id)
    expect(clearedTask?.dueAt).toBeUndefined()
  })

  it('normalizes legacy priority-based data to visibility', async () => {
    const home = await mkdtemp(join(tmpdir(), 'kanban-store-test-'))
    vi.stubEnv('HOME', home)

    const kanbanDir = join(home, '.hermes', 'kanban')
    await import('node:fs/promises').then(({ mkdir, writeFile }) =>
      mkdir(kanbanDir, { recursive: true }).then(() =>
        writeFile(
          join(kanbanDir, 'tasks.json'),
          JSON.stringify({
            boards: [
              {
                id: 'board-1',
                name: 'Legacy Board',
                order: 0,
                createdAt: 1,
                updatedAt: 1,
                config: {
                  columns: [
                    { key: 'todo', title: 'To Do', visible: true },
                  ],
                  defaults: { status: 'todo', priority: 'yes' },
                  reviewRequired: false,
                  allowDoneDragBypass: false,
                  quickViewLimit: 50,
                  proposalPolicy: 'confirm',
                },
              },
            ],
            tasks: [
              {
                id: 'task-1',
                boardId: 'board-1',
                title: 'Legacy task',
                status: 'todo',
                priority: 'somewhat',
                createdBy: 'operator',
                createdAt: 1,
                updatedAt: 1,
                version: 1,
                labels: [],
                columnOrder: 0,
              },
            ],
          }),
          'utf-8',
        ),
      ),
    )

    const store = await import('./kanban-store')
    const boards = await store.listBoards()
    const tasks = await store.listTasks({ boardId: 'board-1' })

    expect(boards[0]?.config.defaults.visibility).toBe('yes')
    expect(tasks.tasks[0]?.visibility).toBe('somewhat')
  })

  it('updates board config column titles', async () => {
    const home = await mkdtemp(join(tmpdir(), 'kanban-store-test-'))
    vi.stubEnv('HOME', home)

    const store = await import('./kanban-store')
    const [board] = await store.listBoards()

    const updated = await store.updateBoard(board.id, {
      config: {
        ...board.config,
        columns: board.config.columns.map((column) =>
          column.key === 'todo' ? { ...column, title: 'Ready Next' } : column,
        ),
      },
    })

    expect(updated.config.columns.find((column) => column.key === 'todo')?.title).toBe('Ready Next')

    const raw = await readFile(join(home, '.hermes', 'kanban', 'tasks.json'), 'utf-8')
    const data = JSON.parse(raw) as {
      boards: Array<{ id: string; config: { columns: Array<{ key: string; title: string }> } }>
    }

    expect(
      data.boards
        .find((savedBoard) => savedBoard.id === board.id)
        ?.config.columns.find((column) => column.key === 'todo')?.title,
    ).toBe('Ready Next')
  })
})
