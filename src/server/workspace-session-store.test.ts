import { describe, expect, it } from 'vitest'

import {
  boundWorkspaceSessionMessages,
  type WorkspaceStoredMessage,
} from './workspace-session-store'

function msg(index: number): WorkspaceStoredMessage {
  return {
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: [{ type: 'text', text: `message ${index}` }],
    text: `message ${index}`,
    timestamp: index,
    createdAt: new Date(index).toISOString(),
    sessionKey: 'portable-session',
  }
}

describe('boundWorkspaceSessionMessages', () => {
  it('returns the newest portable messages and preserves original history indexes', () => {
    const messages = Array.from({ length: 5 }, (_, index) => msg(index))

    expect(boundWorkspaceSessionMessages(messages, 2).map((message) => ({
      id: message.id,
      historyIndex: message.__historyIndex,
    }))).toEqual([
      { id: 'm-3', historyIndex: 3 },
      { id: 'm-4', historyIndex: 4 },
    ])
  })

  it('does not collapse unbounded portable history to main or mutate messages', () => {
    const messages = [msg(0), msg(1)]

    expect(boundWorkspaceSessionMessages(messages).map((message) => ({
      id: message.id,
      sessionKey: message.sessionKey,
      historyIndex: message.__historyIndex,
    }))).toEqual([
      { id: 'm-0', sessionKey: 'portable-session', historyIndex: 0 },
      { id: 'm-1', sessionKey: 'portable-session', historyIndex: 1 },
    ])
    expect(messages[0].__historyIndex).toBeUndefined()
  })
})
