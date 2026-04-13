const VOICE_DRAFT_UPDATED_EVENT = 'hermes:voice-draft-updated'

export function normalizeDraftSessionKey(sessionKey?: string): string {
  if (typeof sessionKey !== 'string') return 'new'
  const normalized = sessionKey.trim()
  return normalized.length > 0 ? normalized : 'new'
}

export function toDraftStorageKey(sessionKey?: string): string {
  return `hermes-draft-${normalizeDraftSessionKey(sessionKey)}`
}

export function readDraftValue(sessionKey?: string): string {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(toDraftStorageKey(sessionKey)) ?? ''
}

export function writeDraftValue(sessionKey: string | undefined, value: string): string {
  if (typeof window === 'undefined') return value
  const storageKey = toDraftStorageKey(sessionKey)
  if (value.length === 0) {
    window.sessionStorage.removeItem(storageKey)
  } else {
    window.sessionStorage.setItem(storageKey, value)
  }
  window.dispatchEvent(
    new CustomEvent(VOICE_DRAFT_UPDATED_EVENT, {
      detail: {
        sessionKey: normalizeDraftSessionKey(sessionKey),
        value,
      },
    }),
  )
  return value
}

export function appendVoiceTranscriptToDraft(
  sessionKey: string | undefined,
  transcript: string,
): string {
  const cleanedTranscript = transcript.trim()
  if (!cleanedTranscript) {
    return readDraftValue(sessionKey)
  }
  const currentDraft = readDraftValue(sessionKey).trim()
  const nextDraft = currentDraft
    ? `${currentDraft} ${cleanedTranscript}`
    : cleanedTranscript
  return writeDraftValue(sessionKey, nextDraft)
}

export { VOICE_DRAFT_UPDATED_EVENT }
