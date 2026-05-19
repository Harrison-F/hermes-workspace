import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../types'
import { isInternalControlUserMessage, resolveRealtimeSessionTargets } from './use-realtime-chat-history'

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

describe('resolveRealtimeSessionTargets', () => {
  it('keeps portable realtime/history targets on the active chat id instead of collapsing to main', () => {
    expect(
      resolveRealtimeSessionTargets({
        sessionKey: 'workspace-portable-abc',
        friendlyId: 'workspace-portable-abc',
      }),
    ).toEqual({
      sessionKey: 'workspace-portable-abc',
      friendlyId: 'workspace-portable-abc',
    })
  })

  it('falls back from legacy main to the actual friendly id when available', () => {
    expect(
      resolveRealtimeSessionTargets({
        sessionKey: 'main',
        friendlyId: 'workspace-portable-def',
      }),
    ).toEqual({
      sessionKey: 'workspace-portable-def',
      friendlyId: 'workspace-portable-def',
    })
  })
})
