import { describe, expect, it } from 'vitest'
import {
  appendVoiceDebugLog,
  collectVoiceDraftEntries,
} from './voice-dictation-debug'

describe('voice dictation debug helpers', () => {
  it('keeps only the newest debug log entries', () => {
    const result = appendVoiceDebugLog(
      [
        { at: '1', event: 'a' },
        { at: '2', event: 'b' },
      ],
      { at: '3', event: 'c' },
      2,
    )

    expect(result).toEqual([
      { at: '2', event: 'b' },
      { at: '3', event: 'c' },
    ])
  })

  it('collects only chat draft entries from session storage', () => {
    const entries = new Map([
      ['hermes-draft-main', 'hello'],
      ['random-key', 'ignore me'],
      ['hermes-draft-session-2', 'world'],
    ])

    const storage = {
      length: entries.size,
      key(index: number) {
        return Array.from(entries.keys())[index] ?? null
      },
      getItem(key: string) {
        return entries.get(key) ?? null
      },
    }

    expect(collectVoiceDraftEntries(storage)).toEqual({
      'hermes-draft-main': 'hello',
      'hermes-draft-session-2': 'world',
    })
  })
})
