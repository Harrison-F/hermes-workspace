import { describe, expect, it } from 'vitest'
import { SHOW_STATUS_ICON_ON_CARD } from './KanbanCard'

describe('KanbanCard status icon visibility', () => {
  it('does not render a status icon in card thumbnails', () => {
    expect(SHOW_STATUS_ICON_ON_CARD).toBe(false)
  })
})
