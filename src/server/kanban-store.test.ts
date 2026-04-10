import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('kanban store board updates', () => {
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
