import { describe, expect, it } from 'vitest'
import {
  createVoiceDictationStore,
  type VoiceDictationSource,
} from './voice-dictation-store'

describe('voice dictation store', () => {
  it('tracks the active source session when dictation starts', () => {
    const store = createVoiceDictationStore()
    const source: VoiceDictationSource = {
      sessionKey: 'session-123',
      friendlyId: 'main',
      origin: 'chat-route',
    }

    store.getState().start(source)

    expect(store.getState().status).toBe('recording')
    expect(store.getState().source).toEqual(source)
  })

  it('moves through transcribing and back to idle while preserving the last source', () => {
    const store = createVoiceDictationStore()
    const source: VoiceDictationSource = {
      sessionKey: 'session-456',
      friendlyId: 'support-thread',
      origin: 'chat-panel',
    }

    store.getState().start(source)
    store.getState().setTranscribing()

    expect(store.getState().status).toBe('transcribing')
    expect(store.getState().source).toEqual(source)

    store.getState().finish()

    expect(store.getState().status).toBe('idle')
    expect(store.getState().source).toBeNull()
  })
})
