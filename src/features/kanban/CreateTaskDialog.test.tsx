import { describe, expect, it } from 'vitest'
import { getCreateTaskDefaults } from './CreateTaskDialog'

describe('getCreateTaskDefaults', () => {
  it('resets new tasks to the requested column status', () => {
    expect(getCreateTaskDefaults('review')).toEqual({
      title: '',
      description: '',
      status: 'review',
      visibility: 'no',
    })
  })

  it('uses the requested board default visibility', () => {
    expect(getCreateTaskDefaults('todo', 'somewhat')).toEqual({
      title: '',
      description: '',
      status: 'todo',
      visibility: 'somewhat',
    })
  })
})
