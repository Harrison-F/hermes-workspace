import { useEffect, useRef, useState } from 'react'
import { collectVoiceDraftEntries } from '@/components/voice-dictation-debug'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { writeTextToClipboard } from '@/lib/clipboard'
import { toast } from '@/components/ui/toast'
import {
  appendVoiceTranscriptToDraft,
  readDraftValue,
  writeDraftValue,
} from '@/screens/chat/voice-draft-storage'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useVoiceDictationStore } from '@/stores/voice-dictation-store'

type VoiceDebugWindow = Window & {
  __dumpVoiceDictationDebug?: () => Record<string, unknown>
  __copyVoiceDictationDebug?: () => Promise<string>
}

export function VoiceDictationManager() {
  const source = useVoiceDictationStore((state) => state.source)
  const status = useVoiceDictationStore((state) => state.status)
  const isSupported = useVoiceDictationStore((state) => state.isSupported)
  const error = useVoiceDictationStore((state) => state.error)
  const debugLog = useVoiceDictationStore((state) => state.debugLog)
  const finish = useVoiceDictationStore((state) => state.finish)
  const setError = useVoiceDictationStore((state) => state.setError)
  const setSupported = useVoiceDictationStore((state) => state.setSupported)
  const registerControls = useVoiceDictationStore((state) => state.registerControls)
  const pushDebugEvent = useVoiceDictationStore((state) => state.pushDebugEvent)

  const [micPermission, setMicPermission] = useState<string>('unknown')
  const lastRecorderLogRef = useRef<{ state: string; secondBucket: number } | null>(null)

  const voiceRecorder = useVoiceRecorder({
    maxDurationMs: 120_000,
    onRecorded: async (blob, durationMs) => {
      const currentSource = useVoiceDictationStore.getState().source
      pushDebugEvent('recording:captured', {
        durationMs,
        size: blob.size,
        contentType: blob.type,
        source: currentSource,
      })

      try {
        const form = new FormData()
        form.append('file', new File([blob], 'voice-dictation.webm', { type: blob.type || 'audio/webm' }))

        const response = await fetch('/api/voice/transcribe', {
          method: 'POST',
          body: form,
        })

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          transcript?: string
          error?: string
          provider?: string
        }

        if (!response.ok || payload.ok === false) {
          const message = payload.error || `Transcription failed (HTTP ${response.status})`
          pushDebugEvent('transcription:error', {
            message,
            httpStatus: response.status,
            provider: payload.provider,
            source: currentSource,
          })
          setError(message)
          toast(message, { type: 'error' })
          return
        }

        const transcript = String(payload.transcript || '').trim()
        const nextDraft = appendVoiceTranscriptToDraft(currentSource?.sessionKey, transcript)
        const immediateDraft = readDraftValue(currentSource?.sessionKey)
        const draftMatchesImmediately = immediateDraft === nextDraft

        pushDebugEvent('transcription:success', {
          transcript,
          transcriptLength: transcript.length,
          nextDraftLength: nextDraft.length,
          provider: payload.provider,
          source: currentSource,
          immediateDraftLength: immediateDraft.length,
          draftMatchesImmediately,
        })

        window.setTimeout(() => {
          const laterDraft = readDraftValue(currentSource?.sessionKey)
          if (laterDraft !== nextDraft) {
            writeDraftValue(currentSource?.sessionKey, nextDraft)
            const repairedDraft = readDraftValue(currentSource?.sessionKey)
            pushDebugEvent('draft:rewritten-after-mismatch', {
              expectedLength: nextDraft.length,
              actualLength: laterDraft.length,
              repairedLength: repairedDraft.length,
              source: currentSource,
            })
            return
          }
          pushDebugEvent('draft:confirmed', {
            draftLength: laterDraft.length,
            source: currentSource,
          })
        }, 150)

        finish()
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : 'Transcription request failed'
        pushDebugEvent('transcription:error', {
          message,
          source: currentSource,
        })
        setError(message)
        toast(message, { type: 'error' })
      }
    },
    onError: (recorderError) => {
      pushDebugEvent('recording:error', { error: recorderError, source })
      setError(recorderError)
      toast(recorderError, { type: 'error' })
    },
  })

  useEffect(() => {
    setSupported(voiceRecorder.isSupported)
  }, [setSupported, voiceRecorder.isSupported])

  useEffect(() => {
    const secondBucket = Math.floor(voiceRecorder.durationMs / 1000)
    const last = lastRecorderLogRef.current
    const shouldLog =
      !last ||
      last.state !== voiceRecorder.state ||
      secondBucket !== last.secondBucket ||
      voiceRecorder.state !== 'recording'

    if (!shouldLog) return

    lastRecorderLogRef.current = {
      state: voiceRecorder.state,
      secondBucket,
    }

    pushDebugEvent('recorder:state', {
      state: voiceRecorder.state,
      durationMs: voiceRecorder.durationMs,
      isRecording: voiceRecorder.isRecording,
    })
  }, [pushDebugEvent, voiceRecorder.durationMs, voiceRecorder.isRecording, voiceRecorder.state])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator) || !(navigator.permissions as any)?.query) {
      setMicPermission('unsupported')
      return
    }

    let cancelled = false
    ;(navigator.permissions as any)
      .query({ name: 'microphone' })
      .then((status: PermissionStatus) => {
        if (cancelled) return
        setMicPermission(status.state)
        pushDebugEvent('permission:microphone', { state: status.state })
        const handleChange = () => {
          setMicPermission(status.state)
          pushDebugEvent('permission:microphone', { state: status.state })
        }
        status.addEventListener?.('change', handleChange)
      })
      .catch((permissionError: unknown) => {
        const message =
          permissionError instanceof Error ? permissionError.message : String(permissionError)
        if (cancelled) return
        setMicPermission(`error:${message}`)
      })

    return () => {
      cancelled = true
    }
  }, [pushDebugEvent])

  useEffect(() => {
    registerControls({
      start: () => {
        voiceRecorder.start()
      },
      stop: () => {
        voiceRecorder.stop()
      },
    })

    return () => {
      registerControls(null)
    }
  }, [registerControls, voiceRecorder.start, voiceRecorder.stop])

  useEffect(() => {
    if (voiceRecorder.state !== 'processing') return
    useVoiceDictationStore.getState().setTranscribing()
  }, [voiceRecorder.state])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const w = window as VoiceDebugWindow
    w.__dumpVoiceDictationDebug = () => {
      const workspaceState = useWorkspaceStore.getState()
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? {
              tagName: document.activeElement.tagName,
              ariaLabel: document.activeElement.getAttribute('aria-label'),
              placeholder: document.activeElement.getAttribute('placeholder'),
            }
          : null
      const textareas = Array.from(document.querySelectorAll('textarea')).map(
        (textarea, index) => ({
          index,
          value: textarea.value,
          placeholder: textarea.getAttribute('placeholder'),
          ariaLabel: textarea.getAttribute('aria-label'),
        }),
      )
      const voiceButtons = Array.from(document.querySelectorAll('button'))
        .map((button) => ({
          ariaLabel: button.getAttribute('aria-label'),
          text: button.textContent?.trim() ?? '',
        }))
        .filter((button) => /voice dictation|recording for|transcribing for/i.test(`${button.ariaLabel ?? ''} ${button.text}`))

      return {
        capturedAt: new Date().toISOString(),
        route: window.location.pathname,
        browser: {
          origin: window.location.origin,
          isSecureContext: window.isSecureContext,
          micPermission,
        },
        media: {
          hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
          hasMediaRecorder: typeof MediaRecorder !== 'undefined',
        },
        store: {
          status,
          source,
          isSupported,
          error,
        },
        workspace: {
          chatPanelOpen: workspaceState.chatPanelOpen,
          chatPanelSessionKey: workspaceState.chatPanelSessionKey,
          sidebarCollapsed: workspaceState.sidebarCollapsed,
        },
        drafts: collectVoiceDraftEntries(window.sessionStorage),
        textareas,
        activeElement,
        voiceButtons,
        recorder: {
          state: voiceRecorder.state,
          durationMs: voiceRecorder.durationMs,
          isRecording: voiceRecorder.isRecording,
          isSupported: voiceRecorder.isSupported,
        },
        debugLog,
      }
    }
    w.__copyVoiceDictationDebug = async () => {
      const dump = JSON.stringify(w.__dumpVoiceDictationDebug?.() ?? {}, null, 2)
      await writeTextToClipboard(dump)
      return dump
    }

    const handleDebugShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toUpperCase() !== 'U') {
        return
      }
      event.preventDefault()
      void w.__copyVoiceDictationDebug?.()
        .then(() => {
          toast('Copied voice dictation debug dump', { type: 'success' })
        })
        .catch(() => {
          toast('Failed to copy voice dictation debug dump', { type: 'error' })
        })
    }

    window.addEventListener('keydown', handleDebugShortcut)
    return () => {
      window.removeEventListener('keydown', handleDebugShortcut)
      delete w.__dumpVoiceDictationDebug
      delete w.__copyVoiceDictationDebug
    }
  }, [
    debugLog,
    error,
    isSupported,
    micPermission,
    source,
    status,
    voiceRecorder.durationMs,
    voiceRecorder.isRecording,
    voiceRecorder.isSupported,
    voiceRecorder.state,
  ])

  return null
}
