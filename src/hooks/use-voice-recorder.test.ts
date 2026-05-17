import { describe, expect, it } from 'vitest'

import { shouldUseMaxRecordingDuration } from './use-voice-recorder'

describe('shouldUseMaxRecordingDuration', () => {
  it('defaults to no max-duration auto-stop', () => {
    expect(shouldUseMaxRecordingDuration(undefined)).toBe(false)
    expect(shouldUseMaxRecordingDuration(null)).toBe(false)
    expect(shouldUseMaxRecordingDuration(0)).toBe(false)
    expect(shouldUseMaxRecordingDuration(-1)).toBe(false)
  })

  it('allows explicit finite max durations for callers that want them', () => {
    expect(shouldUseMaxRecordingDuration(1)).toBe(true)
    expect(shouldUseMaxRecordingDuration(120_000)).toBe(true)
  })
})
