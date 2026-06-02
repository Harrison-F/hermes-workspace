import { describe, expect, it } from 'vitest'

import { mergeCachedTailMessages, resolveChatHistoryTarget } from './use-chat-history'

describe('resolveChatHistoryTarget', () => {
  it('keeps portable chats bound to their actual session id instead of collapsing to main', () => {
    const target = resolveChatHistoryTarget({
      activeFriendlyId: '68e60d0c-953d-4ec5-8270-7489c3e24c57',
      activeSessionKey: '',
      forcedSessionKey: undefined,
      isNewChat: false,
      isRedirecting: false,
      activeExists: true,
      sessionsReady: true,
      portableMode: true,
    })

    expect(target).toEqual({
      sessionKeyForHistory: '68e60d0c-953d-4ec5-8270-7489c3e24c57',
      shouldFetchHistory: true,
      effectiveFriendlyId: '68e60d0c-953d-4ec5-8270-7489c3e24c57',
      effectiveSessionKeyForHistory: '68e60d0c-953d-4ec5-8270-7489c3e24c57',
    })
  })

  it('still uses main for a genuinely unspecific route', () => {
    const target = resolveChatHistoryTarget({
      activeFriendlyId: 'main',
      activeSessionKey: '',
      forcedSessionKey: undefined,
      isNewChat: false,
      isRedirecting: false,
      activeExists: false,
      sessionsReady: false,
      portableMode: true,
    })

    expect(target.sessionKeyForHistory).toBe('main')
    expect(target.effectiveFriendlyId).toBe('main')
    expect(target.shouldFetchHistory).toBe(true)
  })
})

describe('mergeCachedTailMessages', () => {
  it('preserves a newer cached assistant tail when a history refetch returns an older snapshot', () => {
    const serverData = {
      sessionKey: 'chat-1',
      messages: [
        {
          id: 'user-1',
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'question' }],
          createdAt: '2026-06-02T10:00:00.000Z',
        },
      ],
    }

    const cachedAssistant = {
      id: 'assistant-1',
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'latest answer' }],
      createdAt: '2026-06-02T10:00:02.000Z',
    }

    const merged = mergeCachedTailMessages(serverData, [
      serverData.messages[0],
      cachedAssistant,
    ])

    expect(merged.messages.map((message) => message.id)).toEqual([
      'user-1',
      'assistant-1',
    ])
  })

  it('does not resurrect older cached messages over a newer server snapshot', () => {
    const serverData = {
      sessionKey: 'chat-1',
      messages: [
        {
          id: 'user-2',
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'new question' }],
          createdAt: '2026-06-02T10:00:10.000Z',
        },
      ],
    }

    const merged = mergeCachedTailMessages(serverData, [
      {
        id: 'assistant-old',
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'old answer' }],
        createdAt: '2026-06-02T10:00:01.000Z',
      },
    ])

    expect(merged.messages.map((message) => message.id)).toEqual(['user-2'])
  })
})
