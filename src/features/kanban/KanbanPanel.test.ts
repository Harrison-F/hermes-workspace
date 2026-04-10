import { describe, expect, it } from 'vitest'
import { buildTaskContextMenuSections } from './KanbanPanel'
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

describe('buildTaskContextMenuSections', () => {
  it('includes edit, move, visibility, and delete actions', () => {
    const sections = buildTaskContextMenuSections(task)
    const labels = sections.flatMap((section) => section.items.map((item) => item.label))
    const submenuLabels = sections
      .flatMap((section) => section.items)
      .flatMap((item) => item.children?.map((child) => child.label) ?? [])

    expect(labels).toContain('Open details')
    expect(labels).toContain('Delete task')
    expect(labels).toContain('Move to')
    expect(labels).toContain('Visibility')
    expect(labels).toContain('Complete By')
    expect(submenuLabels).toContain('Yes')
    expect(submenuLabels).toContain('Set date')
    expect(submenuLabels).toContain('Somewhat')
    expect(submenuLabels).toContain('Backlog')
    expect(submenuLabels).toContain('In Progress')
  })
})
