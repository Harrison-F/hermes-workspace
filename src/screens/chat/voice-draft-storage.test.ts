// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  appendVoiceTranscriptToDraft,
  readDraftValue,
  toDraftStorageKey,
} from './voice-draft-storage'

describe('voice draft storage', () => {
  it('stores drafts under the normalized session key', () => {
    expect(toDraftStorageKey(undefined)).toBe('hermes-draft-new')
    expect(toDraftStorageKey(' session-123 ')).toBe('hermes-draft-session-123')
  })

  it('appends a voice transcript to an existing unsent draft without auto-sending', () => {
    window.sessionStorage.setItem('hermes-draft-session-123', 'Existing draft')

    const next = appendVoiceTranscriptToDraft('session-123', 'new words here')

    expect(next).toBe('Existing draft new words here')
    expect(readDraftValue('session-123')).toBe('Existing draft new words here')
  })

  it('creates a new draft when none exists yet', () => {
    const next = appendVoiceTranscriptToDraft('session-456', 'hello world')

    expect(next).toBe('hello world')
    expect(readDraftValue('session-456')).toBe('hello world')
  })
})
