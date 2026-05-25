import { describe, expect, it } from 'vitest'

import { normalizeStreamingToolCalls } from './chat-message-list'

describe('normalizeStreamingToolCalls', () => {
  it('preserves live tool args, preview, and result while normalizing phase', () => {
    expect(
      normalizeStreamingToolCalls([
        {
          id: 'toolu_1',
          name: 'search_files',
          phase: 'completed',
          args: { pattern: 'No detail available' },
          preview: 'searching source files',
          result: 'src/screens/chat/components/message-item.tsx: no fallback found',
        },
      ]),
    ).toEqual([
      {
        id: 'toolu_1',
        name: 'search_files',
        phase: 'done',
        args: { pattern: 'No detail available' },
        preview: 'searching source files',
        result: 'src/screens/chat/components/message-item.tsx: no fallback found',
      },
    ])
  })
})
