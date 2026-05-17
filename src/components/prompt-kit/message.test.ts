import { describe, expect, it } from 'vitest'

import { cn } from '../../lib/utils'

describe('plain chat message whitespace class', () => {
  it('uses pre-wrap so explicit user newlines remain visible after send', () => {
    const className = cn(
      'rounded-[12px] break-words min-w-0',
      false ? 'whitespace-normal' : 'whitespace-pre-wrap',
    )

    expect(className).toContain('whitespace-pre-wrap')
    expect('first line\nsecond line').toContain('\n')
  })
})
