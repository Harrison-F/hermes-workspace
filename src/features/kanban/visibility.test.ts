import { describe, expect, it } from 'vitest'
import { CARD_VISIBILITY_OUTLINE, visibilityPillClasses } from './tone'
import { VISIBILITY_LABELS } from './types'

describe('kanban visibility helpers', () => {
  it('maps visibility options to the requested labels', () => {
    expect(VISIBILITY_LABELS.yes).toBe('Yes')
    expect(VISIBILITY_LABELS.no).toBe('No')
    expect(VISIBILITY_LABELS.somewhat).toBe('Somewhat')
  })

  it('uses blue and orange outlines for visible card thumbnails', () => {
    expect(CARD_VISIBILITY_OUTLINE.yes).toContain('border-blue-500')
    expect(CARD_VISIBILITY_OUTLINE.somewhat).toContain('border-orange-500')
    expect(CARD_VISIBILITY_OUTLINE.no).toContain('border-transparent')
  })

  it('returns pill classes for visibility filters and editors', () => {
    expect(visibilityPillClasses('yes')).toContain('text-blue-500')
    expect(visibilityPillClasses('somewhat')).toContain('text-orange-500')
    expect(visibilityPillClasses('no')).toContain('text-gray-500')
  })
})
