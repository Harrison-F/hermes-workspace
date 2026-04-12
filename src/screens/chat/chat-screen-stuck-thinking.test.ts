import { describe, expect, it } from 'vitest'
import {
  hasPendingSend,
  readPendingMessage,
  resetPendingSend,
  setPendingGeneration,
} from './pending-send'
import type { ChatMessage } from './types'

function getInitialWaitingForResponse() {
  return false
}

function shouldRestoreWaitingForResponse(args: {
  hasPendingSend: boolean
  hasPendingGeneration: boolean
  pendingSessionKey: string
  friendlyId: string
}) {
  const persistedPending = args.pendingSessionKey
    ? readPendingMessage(args.pendingSessionKey, args.friendlyId)
    : null

  if (args.hasPendingSend || args.hasPendingGeneration) {
    if (persistedPending) return true
    resetPendingSend()
  }

  return false
}

function messageFallbackSignature(message: ChatMessage): string {
  const raw = message as Record<string, unknown>
  const timestamp =
    typeof raw.timestamp === 'number'
      ? String(raw.timestamp)
      : typeof raw.timestamp === 'string'
        ? raw.timestamp.trim()
        : ''

  const contentParts = Array.isArray(message.content)
    ? message.content
        .map((part: any) => {
          if (part.type === 'text') {
            return `t:${typeof part.text === 'string' ? part.text.trim() : ''}`
          }
          if (part.type === 'thinking') {
            return `th:${typeof part.thinking === 'string' ? part.thinking : ''}`
          }
          if (part.type === 'toolCall') {
            return `tc:${part.id ?? ''}:${part.name ?? ''}`
          }
          return `p:${part.type ?? ''}`
        })
        .join('|')
    : ''

  return `${message.role ?? 'unknown'}:${timestamp}:${contentParts}`
}

function shouldClearWaitingForAssistantAppearance(args: {
  baselineCount: number
  baselineAssistantId: string | null
  baselineAssistantSignature: string
  lastMessage: ChatMessage | null
  currentCount: number
}) {
  const last = args.lastMessage
  if (!last || last.role !== 'assistant') return false
  if ((last as Record<string, unknown>).__streamingStatus === 'streaming') return false

  const raw = last as Record<string, unknown>
  const currentId = String(
    raw.__optimisticId ?? raw.id ?? raw.messageId ?? raw.__realtimeSequence ?? '',
  )
  const countGrew = args.currentCount > args.baselineCount
  const identityChanged =
    currentId.length > 0 && currentId !== (args.baselineAssistantId ?? '')
  const signatureChanged =
    messageFallbackSignature(last) !== args.baselineAssistantSignature
  const noAssistantAtSend = args.baselineAssistantId === null

  return countGrew || identityChanged || signatureChanged || noAssistantAtSend
}

describe('chat stuck-thinking guard', () => {
  it('does not restore waiting state from stale in-memory generation flags alone', () => {
    resetPendingSend()
    setPendingGeneration(true)

    expect(
      shouldRestoreWaitingForResponse({
        hasPendingSend: false,
        hasPendingGeneration: true,
        pendingSessionKey: 'main',
        friendlyId: 'main',
      }),
    ).toBe(false)
  })

  it('does not bootstrap waiting from global pending flags without a persisted send', () => {
    resetPendingSend()
    setPendingGeneration(true)

    const initialWaitingForResponse = getInitialWaitingForResponse()

    expect(hasPendingSend()).toBe(false)
    expect(initialWaitingForResponse).toBe(false)
    expect(
      shouldRestoreWaitingForResponse({
        hasPendingSend: false,
        hasPendingGeneration: true,
        pendingSessionKey: 'main',
        friendlyId: 'main',
      }),
    ).toBe(false)
  })

  it('clears waiting when the visible assistant reply changes without a new id or higher count', () => {
    const previousAssistant: ChatMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Previous reply' }],
      timestamp: '2026-04-11T18:00:00.000Z',
    }
    const finalAssistant: ChatMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Final reply after compaction' }],
      timestamp: '2026-04-11T18:00:00.000Z',
    }

    expect(
      shouldClearWaitingForAssistantAppearance({
        baselineCount: 12,
        baselineAssistantId: null,
        baselineAssistantSignature: messageFallbackSignature(previousAssistant),
        lastMessage: finalAssistant,
        currentCount: 12,
      }),
    ).toBe(true)
  })
})
