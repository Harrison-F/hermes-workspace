import { describe, expect, it } from 'vitest'
import {
  shouldDetachStreamOnUnmount,
  shouldResolveStreamSession,
} from './use-streaming-message'

describe('shouldResolveStreamSession', () => {
  it('does not promote backend api session ids over concrete Workspace sessions', () => {
    expect(
      shouldResolveStreamSession({
        requestedSessionKey: 'api-original-workspace',
        currentSessionKey: 'api-original-workspace',
        resolvedSessionKey: 'api-derived-backend',
      }),
    ).toBe(false)
  })

  it('allows bootstrap new chats to resolve once to a concrete session', () => {
    expect(
      shouldResolveStreamSession({
        requestedSessionKey: 'new',
        currentSessionKey: 'new',
        resolvedSessionKey: 'api-created-session',
      }),
    ).toBe(true)
  })

  it('keeps portable main chats pinned instead of promoting a backend session id', () => {
    expect(
      shouldResolveStreamSession({
        requestedSessionKey: 'main',
        currentSessionKey: 'main',
        resolvedSessionKey: 'existing-main-session',
        pinMainSession: true,
      }),
    ).toBe(false)
  })

  it('still resolves main chats when the route is not pinned to a portable session', () => {
    expect(
      shouldResolveStreamSession({
        requestedSessionKey: 'main',
        currentSessionKey: 'main',
        resolvedSessionKey: 'existing-main-session',
        pinMainSession: false,
      }),
    ).toBe(true)
  })
})

describe('shouldDetachStreamOnUnmount', () => {
  it('keeps accepted, active, and handoff streams alive across chat-view unmounts', () => {
    expect(shouldDetachStreamOnUnmount('accepted')).toBe(true)
    expect(shouldDetachStreamOnUnmount('active')).toBe(true)
    expect(shouldDetachStreamOnUnmount('handoff')).toBe(true)
  })

  it('allows abort/reset before backend acceptance or after terminal states', () => {
    expect(shouldDetachStreamOnUnmount('idle')).toBe(false)
    expect(shouldDetachStreamOnUnmount('requesting')).toBe(false)
    expect(shouldDetachStreamOnUnmount('complete')).toBe(false)
    expect(shouldDetachStreamOnUnmount('error')).toBe(false)
  })
})
