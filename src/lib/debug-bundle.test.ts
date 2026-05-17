import { describe, expect, it } from 'vitest'
import {
  buildDebugBundle,
  matchesDebugShortcut,
  type DebugBundlePayload,
} from './debug-bundle'

describe('debug bundle', () => {
  it('matches Cmd/Ctrl+Shift+Alt+L only', () => {
    expect(
      matchesDebugShortcut({
        key: 'l',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: true,
      }),
    ).toBe(true)

    expect(
      matchesDebugShortcut({
        key: 'l',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false)
  })

  it('formats a pasteable debug bundle with key sections', () => {
    const payload: DebugBundlePayload = {
      generatedAt: '2026-04-13T03:30:00.000Z',
      route: '/chat/demo-session',
      sessionKey: 'demo-session',
      selectedMessageId: 'msg-123',
      appVersion: 'dev',
      uiEvents: [{ at: '2026-04-13T03:29:59.000Z', type: 'ui', message: 'Clicked Branch from here' }],
      networkEvents: [
        {
          at: '2026-04-13T03:29:58.000Z',
          type: 'network',
          message: 'POST /api/sessions/branch -> 500 (42ms)',
        },
      ],
      consoleEvents: [
        {
          at: '2026-04-13T03:29:57.000Z',
          type: 'console',
          level: 'error',
          message: 'Failed to branch session',
        },
      ],
      stateSnapshot: {
        chatPanelOpen: true,
        chatPanelSessionKey: 'demo-session',
      },
    }

    const text = buildDebugBundle(payload)
    expect(text).toContain('HERMES WORKSPACE DEBUG BUNDLE')
    expect(text).toContain('Route: /chat/demo-session')
    expect(text).toContain('Session Key: demo-session')
    expect(text).toContain('Selected Message ID: msg-123')
    expect(text).toContain('Clicked Branch from here')
    expect(text).toContain('POST /api/sessions/branch -> 500 (42ms)')
    expect(text).toContain('Failed to branch session')
    expect(text).toContain('"chatPanelOpen": true')
  })
})
