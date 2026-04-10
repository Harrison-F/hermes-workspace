import { describe, expect, it } from 'vitest'
import { getNextColumnTitle } from './KanbanColumn'

describe('getNextColumnTitle', () => {
  it('returns a trimmed renamed title when it changes', () => {
    expect(getNextColumnTitle('To Do', '  Ready Next  ')).toBe('Ready Next')
  })

  it('returns null for blank or unchanged titles', () => {
    expect(getNextColumnTitle('To Do', '   ')).toBeNull()
    expect(getNextColumnTitle('To Do', 'To Do')).toBeNull()
  })
})
