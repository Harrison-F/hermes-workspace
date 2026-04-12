// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { useChatStore } from './chat-store'

afterEach(() => {
  useChatStore.getState().clearSession('main')
  useChatStore.getState().clearAllStreaming()
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear()
  }
})

describe('chat-store streaming lifecycle', () => {
  it('clears streaming state on done events', () => {
    const store = useChatStore.getState()

    store.processEvent({
      type: 'thinking',
      text: 'Thinking…',
      sessionKey: 'main',
      runId: 'run-1',
    })
    store.processEvent({
      type: 'chunk',
      text: 'Hello world',
      fullReplace: true,
      sessionKey: 'main',
      runId: 'run-1',
    })

    expect(useChatStore.getState().getStreamingState('main')).not.toBeNull()

    store.processEvent({
      type: 'done',
      state: 'complete',
      sessionKey: 'main',
      runId: 'run-1',
    })

    expect(useChatStore.getState().getStreamingState('main')).toBeNull()
    expect(useChatStore.getState().getRealtimeMessages('main').some((msg) => msg.role === 'assistant')).toBe(true)
  })

  it('still processes chat-events done for active send-stream runs', () => {
    const store = useChatStore.getState()

    store.registerSendStreamRun('run-3')
    store.processEvent({
      type: 'chunk',
      text: 'Partial reply',
      fullReplace: true,
      sessionKey: 'main',
      runId: 'run-3',
      transport: 'send-stream',
    })

    expect(store.getStreamingState('main')?.text).toBe('Partial reply')

    store.processEvent({
      type: 'done',
      state: 'complete',
      sessionKey: 'main',
      runId: 'run-3',
      transport: 'chat-events',
      message: {
        id: 'assistant-run-3',
        role: 'assistant',
        content: [{ type: 'text', text: 'Final reply' }],
        timestamp: Date.now(),
      },
    })

    expect(store.getStreamingState('main')).toBeNull()
    expect(
      store.getRealtimeMessages('main').some(
        (msg) =>
          msg.role === 'assistant' &&
          (msg.content?.[0] as { text?: string } | undefined)?.text === 'Final reply',
      ),
    ).toBe(true)
  })

  it('clearStreamingSession removes stale thinking state explicitly', () => {
    const store = useChatStore.getState()

    store.processEvent({
      type: 'thinking',
      text: 'Still thinking…',
      sessionKey: 'main',
      runId: 'run-2',
    })

    expect(useChatStore.getState().getStreamingState('main')?.thinking).toBe('Still thinking…')

    store.clearStreamingSession('main')

    expect(useChatStore.getState().getStreamingState('main')).toBeNull()
  })
})
