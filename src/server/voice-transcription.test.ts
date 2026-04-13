import { describe, expect, it } from 'vitest'
import { guessAudioExtension } from './voice-transcription'

describe('guessAudioExtension', () => {
  it('prefers extensions inferred from content type', () => {
    expect(guessAudioExtension(undefined, 'audio/webm;codecs=opus')).toBe('.webm')
    expect(guessAudioExtension(undefined, 'audio/mp4')).toBe('.m4a')
    expect(guessAudioExtension(undefined, 'audio/mpeg')).toBe('.mp3')
  })

  it('falls back to filename when content type is missing', () => {
    expect(guessAudioExtension('clip.wav', undefined)).toBe('.wav')
    expect(guessAudioExtension('clip.ogg', undefined)).toBe('.ogg')
  })
})
