import { describe, expect, it } from 'vitest'

import { resolveChatHistoryTarget } from './use-chat-history'

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
