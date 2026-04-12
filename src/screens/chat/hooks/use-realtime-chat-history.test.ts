import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../types'
import { isInternalControlUserMessage } from './use-realtime-chat-history'

function makeUserMessage(text: string): ChatMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  }
}

describe('isInternalControlUserMessage', () => {
  it('detects internal control prompts that should not retrigger thinking UI', () => {
    expect(
      isInternalControlUserMessage(
        makeUserMessage('Pre-compaction memory flush: summarize recent context'),
      ),
    ).toBe(true)

    expect(
      isInternalControlUserMessage(
        makeUserMessage('Stats: runtime 12s sessionKey agent: abc123'),
      ),
    ).toBe(true)

    expect(
      isInternalControlUserMessage(
        makeUserMessage('Store durable memories now before continuing'),
      ),
    ).toBe(true)
  })

  it('does not classify real user prompts as internal control messages', () => {
    expect(
      isInternalControlUserMessage(
        makeUserMessage('Please draft a reply to this email and keep it short.'),
      ),
    ).toBe(false)
  })
})
