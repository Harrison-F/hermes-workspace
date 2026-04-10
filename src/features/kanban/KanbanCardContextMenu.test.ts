import { describe, expect, it } from 'vitest'
import { KANBAN_CARD_CONTEXT_ATTR } from './KanbanCard'

describe('KanbanCard context menu targeting', () => {
  it('marks card roots with the task-id data attribute used by the panel context menu', () => {
    expect(KANBAN_CARD_CONTEXT_ATTR).toBe('data-task-id')
  })
})
