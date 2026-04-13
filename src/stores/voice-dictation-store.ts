import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { appendVoiceDebugLog } from '@/components/voice-dictation-debug'

export type VoiceDictationStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'error'
  | 'unsupported'

export type VoiceDictationOrigin = 'chat-route' | 'chat-panel'

export type VoiceDictationSource = {
  sessionKey?: string
  friendlyId: string
  origin: VoiceDictationOrigin
}

type VoiceDictationControls = {
  start: () => void
  stop: () => void
}

export type VoiceDictationDebugEntry = {
  at: string
  event: string
  detail?: Record<string, unknown>
}

export type VoiceDictationStoreState = {
  status: VoiceDictationStatus
  source: VoiceDictationSource | null
  isSupported: boolean
  error: string | null
  debugLog: Array<VoiceDictationDebugEntry>
  registerControls: (controls: VoiceDictationControls | null) => void
  setSupported: (supported: boolean) => void
  start: (source: VoiceDictationSource) => void
  stop: () => void
  setTranscribing: () => void
  setError: (message: string) => void
  finish: () => void
  pushDebugEvent: (event: string, detail?: Record<string, unknown>) => void
}

function createVoiceDictationState(
  set: (partial: Partial<VoiceDictationStoreState>) => void,
  get: () => VoiceDictationStoreState,
): VoiceDictationStoreState {
  let controls: VoiceDictationControls | null = null

  const pushDebugEvent = (
    event: string,
    detail?: Record<string, unknown>,
  ) => {
    set({
      debugLog: appendVoiceDebugLog(get().debugLog, {
        at: new Date().toISOString(),
        event,
        detail,
      }),
    })
  }

  return {
    status: 'idle',
    source: null,
    isSupported: true,
    error: null,
    debugLog: [],
    registerControls(nextControls) {
      controls = nextControls
    },
    setSupported(supported) {
      set({
        isSupported: supported,
        status: supported ? get().status : 'unsupported',
      })
      pushDebugEvent('support:changed', { supported })
    },
    start(source) {
      if (!get().isSupported) {
        set({
          status: 'unsupported',
          source,
          error: 'Speech recognition not supported in this browser',
        })
        pushDebugEvent('start:unsupported', { source })
        return
      }
      set({ status: 'recording', source, error: null })
      pushDebugEvent('start', { source })
      controls?.start()
    },
    stop() {
      const { status } = get()
      if (status !== 'recording') return
      set({ status: 'transcribing' })
      pushDebugEvent('stop', { source: get().source })
      controls?.stop()
    },
    setTranscribing() {
      set({ status: 'transcribing' })
      pushDebugEvent('transcribing', { source: get().source })
    },
    setError(message) {
      set({ status: 'error', error: message })
      pushDebugEvent('error', { message, source: get().source })
    },
    finish() {
      const previousSource = get().source
      set({
        status: 'idle',
        source: null,
        error: null,
      })
      pushDebugEvent('finish', { source: previousSource })
    },
    pushDebugEvent,
  }
}

export function createVoiceDictationStore() {
  return createStore<VoiceDictationStoreState>((set, get) =>
    createVoiceDictationState(set, get),
  )
}

const voiceDictationStore = createVoiceDictationStore()

export const useVoiceDictationStore = create<VoiceDictationStoreState>((set, get) =>
  createVoiceDictationState(
    (partial) => set(partial),
    get,
  ),
)

export { voiceDictationStore }
