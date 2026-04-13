export type VoiceDebugLogEntry = {
  at: string
  event: string
  detail?: Record<string, unknown>
}

export function appendVoiceDebugLog(
  current: Array<VoiceDebugLogEntry>,
  entry: VoiceDebugLogEntry,
  maxEntries = 30,
): Array<VoiceDebugLogEntry> {
  return [...current, entry].slice(-maxEntries)
}

export function collectVoiceDraftEntries(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>,
): Record<string, string> {
  const drafts: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || !key.startsWith('hermes-draft-')) continue
    drafts[key] = storage.getItem(key) ?? ''
  }
  return drafts
}
