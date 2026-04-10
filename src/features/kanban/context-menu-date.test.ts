import { describe, expect, it } from 'vitest'
import { buildTaskContextMenuSections, formatCompleteByDateInputValue } from './KanbanPanel'
import type { KanbanTask } from './types'

const task: KanbanTask = {
  id: 'task-1',
  boardId: 'board-1',
  title: 'Example task',
  status: 'todo',
  visibility: 'no',
  createdBy: 'operator',
  createdAt: 1,
  updatedAt: 1,
  version: 1,
  labels: [],
  columnOrder: 0,
  feedback: [],
}

describe('kanban context menu helpers', () => {
  it('builds nested submenu sections for move, visibility, and complete-by', () => {
    const sections = buildTaskContextMenuSections(task)
    const menuLabels = sections.flatMap((section) => section.items.map((item) => item.label))

    expect(menuLabels).toContain('Move to')
    expect(menuLabels).toContain('Visibility')
    expect(menuLabels).toContain('Complete By')

    const moveItem = sections.flatMap((section) => section.items).find((item) => item.label === 'Move to')
    const visibilityItem = sections.flatMap((section) => section.items).find((item) => item.label === 'Visibility')
    const completeByItem = sections.flatMap((section) => section.items).find((item) => item.label === 'Complete By')

    expect(moveItem?.children?.some((item) => item.label === 'Backlog')).toBe(true)
    expect(visibilityItem?.children?.some((item) => item.label === 'Somewhat')).toBe(true)
    expect(completeByItem?.children?.some((item) => item.kind === 'date')).toBe(true)
  })

  it('formats due dates for date inputs', () => {
    expect(formatCompleteByDateInputValue(undefined)).toBe('')
    expect(formatCompleteByDateInputValue(Date.UTC(2026, 3, 10, 15, 30))).toBe('2026-04-10')
  })
})
