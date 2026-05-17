import { describe, expect, it } from 'vitest'
import { shouldFocusChatShortcut } from './use-global-shortcuts'

describe('global shortcut helpers', () => {
  it('keeps Cmd/Ctrl+Shift+L reserved for debug, not focus-chat', () => {
    expect(
      shouldFocusChatShortcut({
        key: 'l',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false)
  })

  it('uses Cmd/Ctrl+Shift+K for focus-chat', () => {
    expect(
      shouldFocusChatShortcut({
        key: 'k',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(true)
  })
})
