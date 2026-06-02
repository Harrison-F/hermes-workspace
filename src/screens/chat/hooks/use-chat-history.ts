import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { chatQueryKeys, fetchHistory } from '../chat-queries'
import { getMessageTimestamp, textFromMessage } from '../utils'
import {
  cleanupExpiredPendingSends,
  clearPendingMessage,
  persistPendingMessage,
  readPendingMessage,
} from '../pending-send'
import {
  clearRecoveryMessage,
  readRecoveryMessage,
} from '../../../stores/chat-store'
import { useChatSettingsStore } from '../../../hooks/use-chat-settings'
import type { PendingSendPayload } from '../pending-send'
import type { QueryClient } from '@tanstack/react-query'
import type { ChatMessage, HistoryResponse } from '../types'

type UseChatHistoryInput = {
  activeFriendlyId: string
  activeSessionKey: string
  forcedSessionKey?: string
  isNewChat: boolean
  isRedirecting: boolean
  activeExists: boolean
  sessionsReady: boolean
  queryClient: QueryClient
  historyRefetchInterval?: number
  /** When true, use the workspace-local session store instead of legacy browser-only history. */
  portableMode?: boolean
}

type ChatHistoryTargetInput = Omit<UseChatHistoryInput, 'queryClient' | 'historyRefetchInterval'>

export type ChatHistoryTarget = {
  sessionKeyForHistory: string
  shouldFetchHistory: boolean
  effectiveFriendlyId: string
  effectiveSessionKeyForHistory: string
}

function normalizeSessionCandidate(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed === 'new') return ''
  return trimmed
}

type ExecNotification = {
  name: string
  exitCode: number | null
  ok: boolean | null
}

function coerceExitCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
  }
  return null
}

function parseExecNotification(text: string): ExecNotification | null {
  const trimmed = text.trim()
  if (!/^Exec completed\b/i.test(trimmed)) return null

  let name = ''
  let exitCode: number | null = null
  let ok: boolean | null = null

  const jsonMatch = trimmed.match(/\{[\s\S]*\}$/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      const rawName =
        parsed.name ??
        parsed.command ??
        parsed.cmd ??
        parsed.title ??
        parsed.label ??
        parsed.task
      if (typeof rawName === 'string') name = rawName.trim()

      const rawExit =
        parsed.exit_code ??
        parsed.exitCode ??
        parsed.code ??
        parsed.status_code ??
        parsed.statusCode ??
        parsed.exitStatus ??
        parsed.status
      exitCode = coerceExitCode(rawExit)

      const rawOk = parsed.ok ?? parsed.success
      if (typeof rawOk === 'boolean') ok = rawOk

      if (exitCode === null && typeof rawExit === 'string') {
        const normalized = rawExit.toLowerCase()
        if (normalized.includes('success') || normalized.includes('ok'))
          ok = true
        if (normalized.includes('fail') || normalized.includes('error'))
          ok = false
      }
    } catch {
      // Fall through to regex parsing.
    }
  }

  if (!name) {
    const withoutPrefix = trimmed.replace(/^Exec completed[:\s-]*/i, '').trim()
    const nameMatch = withoutPrefix.match(/^([^\(\{\[]+?)(?:\s*\(|\s*$)/)
    if (nameMatch) name = nameMatch[1].trim()
  }

  if (exitCode === null) {
    const exitMatch =
      trimmed.match(/exit(?:_|\s)?code\s*[:=]?\s*(-?\d+)/i) ??
      trimmed.match(/\bcode\s*[:=]?\s*(-?\d+)/i)
    if (exitMatch) exitCode = coerceExitCode(exitMatch[1])
  }

  if (ok === null && exitCode !== null) ok = exitCode === 0

  return {
    name: name || 'Exec',
    exitCode,
    ok,
  }
}

function normalizeMessageValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getMessageClientId(message: ChatMessage): string {
  const raw = message as Record<string, unknown>
  return (
    normalizeMessageValue(raw.clientId) ||
    normalizeMessageValue(raw.client_id) ||
    normalizeMessageValue(raw.idempotencyKey)
  )
}

function getAttachmentSignature(message: ChatMessage): string {
  if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
    return ''
  }

  return message.attachments
    .map((attachment) => {
      const name = typeof attachment?.name === 'string' ? attachment.name : ''
      const size =
        typeof attachment?.size === 'number' ? String(attachment.size) : ''
      const type =
        typeof attachment?.contentType === 'string'
          ? attachment.contentType
          : ''
      return `${name}:${size}:${type}`
    })
    .sort()
    .join('|')
}

function isOptimisticUserMessage(message: ChatMessage): boolean {
  if (message.role !== 'user') return false
  const raw = message as Record<string, unknown>
  return (
    normalizeMessageValue(raw.status) === 'sending' ||
    normalizeMessageValue(raw.__optimisticId).length > 0
  )
}

function isSameUserMessage(a: ChatMessage, b: ChatMessage): boolean {
  if (a.role !== 'user' || b.role !== 'user') return false

  const aClientId = getMessageClientId(a)
  const bClientId = getMessageClientId(b)
  if (aClientId && bClientId && aClientId === bClientId) return true

  const aText = textFromMessage(a).trim()
  const bText = textFromMessage(b).trim()
  if (aText && bText && aText === bText) return true

  const aAttachments = getAttachmentSignature(a)
  const bAttachments = getAttachmentSignature(b)
  if (aAttachments && bAttachments && aAttachments === bAttachments) return true

  return false
}

function hasConfirmedPendingMessage(
  serverMessages: Array<ChatMessage>,
  pendingMessage: ChatMessage,
): boolean {
  const pendingTimestamp = getMessageTimestamp(pendingMessage)

  return serverMessages.some((message) => {
    if (message.role !== 'user') return false
    if (isOptimisticUserMessage(message)) return false
    if (!isSameUserMessage(message, pendingMessage)) return false
    const messageTimestamp = getMessageTimestamp(message)
    return Math.abs(messageTimestamp - pendingTimestamp) <= 5 * 60 * 1000
  })
}

/**
 * Extract the best available string ID from a ChatMessage without type-unsafe
 * `as any` casts. ChatMessage carries `[key: string]: unknown` so bracket
 * access is legal and keeps TypeScript's narrowing intact.
 */
function extractMsgId(msg: ChatMessage): string {
  const id =
    msg['id'] ?? msg['message_id'] ?? msg['clientId'] ?? msg['client_id']
  return typeof id === 'string' ? id : ''
}

/** Check whether a history array already contains an equivalent message. */
function historyContainsMessage(
  messages: Array<ChatMessage>,
  candidate: ChatMessage,
): boolean {
  if (!candidate.role) return false
  const candidateText = textFromMessage(candidate).trim()
  const candidateId = extractMsgId(candidate)

  return messages.some((msg) => {
    if (msg.role !== candidate.role) return false
    const msgId = extractMsgId(msg)
    if (candidateId && msgId && candidateId === msgId) return true
    if (candidateText) {
      const msgText = textFromMessage(msg).trim()
      if (msgText === candidateText) return true
    }
    return false
  })
}

export function resolveChatHistoryTarget({
  activeFriendlyId,
  activeSessionKey,
  forcedSessionKey,
  isNewChat,
  isRedirecting,
  activeExists,
  sessionsReady,
  portableMode = false,
}: ChatHistoryTargetInput): ChatHistoryTarget {
  const normalizedFriendlyId = normalizeSessionCandidate(activeFriendlyId)
  const explicitRouteSessionKey =
    normalizedFriendlyId && normalizedFriendlyId !== 'main'
      ? normalizedFriendlyId
      : ''
  const normalizedForcedSessionKey = normalizeSessionCandidate(forcedSessionKey)
  const normalizedActiveSessionKey = normalizeSessionCandidate(activeSessionKey)
  const candidates = [
    normalizedForcedSessionKey,
    normalizedActiveSessionKey,
    explicitRouteSessionKey,
  ]
  const sessionKeyForHistory =
    candidates.find((candidate) => candidate.length > 0) || 'main'
  const hasDirectSessionKey = Boolean(
    normalizedForcedSessionKey ||
      normalizedActiveSessionKey ||
      explicitRouteSessionKey,
  )
  const canFetchWithoutSessions = Boolean(
    normalizedForcedSessionKey || explicitRouteSessionKey,
  )
  const shouldFetchHistory =
    !isNewChat &&
    Boolean(sessionKeyForHistory) &&
    (portableMode ||
      canFetchWithoutSessions ||
      (!isRedirecting &&
        (hasDirectSessionKey || !sessionsReady || activeExists)))

  return {
    sessionKeyForHistory,
    shouldFetchHistory,
    effectiveFriendlyId: portableMode ? sessionKeyForHistory : activeFriendlyId,
    effectiveSessionKeyForHistory: sessionKeyForHistory,
  }
}

export function useChatHistory({
  activeFriendlyId,
  activeSessionKey,
  forcedSessionKey,
  isNewChat,
  isRedirecting,
  activeExists,
  sessionsReady,
  queryClient,
  historyRefetchInterval,
  portableMode = false,
}: UseChatHistoryInput) {
  const {
    sessionKeyForHistory,
    shouldFetchHistory,
    effectiveFriendlyId,
    effectiveSessionKeyForHistory,
  } = useMemo(
    () =>
      resolveChatHistoryTarget({
        activeFriendlyId,
        activeSessionKey,
        forcedSessionKey,
        isNewChat,
        isRedirecting,
        activeExists,
        sessionsReady,
        portableMode,
      }),
    [
      activeExists,
      activeFriendlyId,
      activeSessionKey,
      forcedSessionKey,
      isNewChat,
      isRedirecting,
      portableMode,
      sessionsReady,
    ],
  )
  const historyKey = chatQueryKeys.history(
    effectiveFriendlyId,
    effectiveSessionKeyForHistory,
  )

  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: async function fetchHistoryForSession() {
      const cached = queryClient.getQueryData(historyKey)
      const optimisticMessages = Array.isArray((cached as any)?.messages)
        ? (cached as any).messages.filter((message: any) => {
          if (message.status === 'sending') return true
          if (message.__optimisticId) return true
          return Boolean(message.clientId)
        })
        : []

      const serverData = await fetchHistory({
        sessionKey: sessionKeyForHistory,
        friendlyId: effectiveFriendlyId,
      })

      let dataWithRecovery = serverData

      // Merge recovery buffer: if the backend history hasn't caught up with a
      // recently-streamed assistant message (e.g. after dev refresh), inject it
      // so the message doesn't vanish from the UI.
      if (typeof window !== 'undefined') {
        const recoveryMessage = readRecoveryMessage(sessionKeyForHistory)
        if (recoveryMessage) {
          if (historyContainsMessage(serverData.messages, recoveryMessage)) {
            clearRecoveryMessage(sessionKeyForHistory)
          } else {
            const mergedMessages = [...serverData.messages, recoveryMessage]
            mergedMessages.sort(
              (a, b) => getMessageTimestamp(a) - getMessageTimestamp(b),
            )
            dataWithRecovery = { ...serverData, messages: mergedMessages }
          }
        }
      }

      const cachedMessages = Array.isArray((cached as any)?.messages)
        ? ((cached as any).messages as Array<ChatMessage>)
        : []
      const dataWithCachedTail = mergeCachedTailMessages(
        dataWithRecovery,
        cachedMessages,
      )

      if (!optimisticMessages.length) return dataWithCachedTail

      const merged = mergeOptimisticHistoryMessages(
        dataWithCachedTail.messages,
        optimisticMessages,
      )

      return {
        ...dataWithCachedTail,
        messages: merged,
      }
    },
    enabled: shouldFetchHistory,
    initialData: function useInitialHistory(): HistoryResponse | undefined {
      return queryClient.getQueryData<HistoryResponse>(historyKey)
    },
    placeholderData: function useCachedHistory(): HistoryResponse | undefined {
      return queryClient.getQueryData(historyKey)
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: historyRefetchInterval,
    staleTime: 0, // Always refetch on mount — prevents stale data after tab navigation
    gcTime: 1000 * 60 * 10,
    structuralSharing: true,
    notifyOnChangeProps: ['data', 'error', 'isError'],
  })

  const [persistedPending, setPersistedPending] =
    useState<PendingSendPayload | null>(null)

  useEffect(() => {
    cleanupExpiredPendingSends()
    setPersistedPending(
      readPendingMessage(sessionKeyForHistory, effectiveFriendlyId),
    )
  }, [effectiveFriendlyId, sessionKeyForHistory])

  const rawHistoryMessages = useMemo(() => {
    return Array.isArray(historyQuery.data?.messages)
      ? historyQuery.data.messages
      : []
  }, [historyQuery.data?.messages])

  useEffect(() => {
    if (!sessionKeyForHistory || sessionKeyForHistory === 'new') return

    const optimisticMessages = rawHistoryMessages.filter(
      isOptimisticUserMessage,
    )
    if (optimisticMessages.length === 0) return

    const latestOptimisticMessage =
      optimisticMessages[optimisticMessages.length - 1]

    persistPendingMessage({
      sessionKey: sessionKeyForHistory,
      friendlyId: effectiveFriendlyId,
      message: textFromMessage(latestOptimisticMessage),
      attachments: Array.isArray(latestOptimisticMessage.attachments)
        ? latestOptimisticMessage.attachments
        : [],
      optimisticMessage: latestOptimisticMessage,
    })
  }, [effectiveFriendlyId, rawHistoryMessages, sessionKeyForHistory])

  useEffect(() => {
    if (!persistedPending) return
    if (
      hasConfirmedPendingMessage(
        rawHistoryMessages,
        persistedPending.optimisticMessage,
      )
    ) {
      clearPendingMessage(persistedPending.sessionKey)
      setPersistedPending(null)
    }
  }, [persistedPending, rawHistoryMessages])

  const stableHistorySignatureRef = useRef('')
  const stableHistoryMessagesRef = useRef<Array<ChatMessage>>([])
  const historyMessages = useMemo(() => {
    const messages = persistedPending
      ? mergeOptimisticHistoryMessages(rawHistoryMessages, [
        persistedPending.optimisticMessage,
      ])
      : rawHistoryMessages
    const last = messages[messages.length - 1]
    const lastId =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety
      last && typeof (last as { id?: string }).id === 'string'
        ? (last as { id?: string }).id
        : ''
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety
    const signature = `${messages.length}:${last?.role ?? ''}:${lastId}:${textFromMessage(last ?? { role: 'user', content: [] }).slice(-32)}`
    if (signature === stableHistorySignatureRef.current) {
      return stableHistoryMessagesRef.current
    }
    stableHistorySignatureRef.current = signature
    stableHistoryMessagesRef.current = messages
    return messages
  }, [persistedPending, rawHistoryMessages])

  const showToolMessages = useChatSettingsStore(
    (s) => s.settings.showToolMessages,
  )

  // Filter messages for display - hide tool calls, system events, etc.
  const displayMessages = useMemo(() => {
    const filtered = historyMessages.filter((msg: ChatMessage) => {
      // Always show user messages (unless system events)
      if (msg.role === 'user') {
        const text = textFromMessage(msg)
        const execNotification = parseExecNotification(text)
        if (execNotification) {
          ; (msg as any).__execNotification = execNotification
          return true
        }
        if ((msg as any).__execNotification) {
          delete (msg as any).__execNotification
        }
        // Filter out system event forwards (subagent task announcements etc)
        if (text.startsWith('A subagent task')) return false
        if (text.startsWith('[Queued announce messages')) return false
        // Hide internal system-forwarded prompts only when the whole message is the
        // system event. Do not hide user-pasted context summaries merely because
        // they quote these phrases somewhere inside the text.
        if (text.startsWith('Pre-compaction memory flush')) return false
        if (text.startsWith('Store durable memories now')) return false
        if (text.startsWith('Summarize this naturally for the user'))
          return false
        if (text.startsWith('APPEND new content only and do not overwrite'))
          return false
        if (
          text.startsWith('Stats: runtime') &&
          text.includes('sessionKey agent:codex:subagent:')
        )
          return false
        return true
      }

      // Show assistant messages only if they have displayable content
      if (msg.role === 'assistant') {
        // Keep streaming placeholders (they show typing indicator)
        if (msg.__streamingStatus === 'streaming') return true
        // Keep optimistic messages that are pending
        if (msg.__optimisticId && !msg.content?.length) return true

        const content = msg.content
        if (!content || !Array.isArray(content)) return false
        if (content.length === 0) return false

        // Has at least one text block with actual content?
        const hasText = content.some(
          (c) =>
            c.type === 'text' &&
            typeof c.text === 'string' &&
            c.text.trim().length > 0,
        )
        if (!hasText) return false

        return true
      }

      // Hide everything else (toolResult, tool, system messages)
      return false
    })

    // Second pass: mark intermediate assistant messages as narration
    // Only hide messages that are PURELY tool calls (no substantial text)
    // Messages with real text + tool calls are real responses — always show them
    for (let i = 0; i < filtered.length; i++) {
      const msg = filtered[i]
      if (msg.role !== 'assistant') continue
      const content = Array.isArray(msg.content) ? msg.content : []
      const hasToolCall = content.some(
        (c: any) =>
          c.type === 'toolCall' ||
          c.type === 'tool_use' ||
          c.type === 'toolUse',
      )
      if (!hasToolCall) continue

      // Check if this message has substantial text (not just empty/whitespace)
      const substantialText = content.some(
        (c: any) =>
          c.type === 'text' &&
          typeof c.text === 'string' &&
          c.text.trim().length > 20,
      )
      // If it has real text content, it's a response — never hide it
      if (substantialText) continue

      const hasLater = filtered
        .slice(i + 1)
        .some((m: ChatMessage) => m.role === 'assistant')
      if (hasLater) {
        if (!showToolMessages) {
          // Hide intermediate narration entirely
          filtered.splice(i, 1)
          i--
        } else {
          ; (msg as any).__isNarration = true
        }
      }
    }

    return filtered
  }, [historyMessages, showToolMessages])

  const messageCount = useMemo(() => {
    return historyMessages.filter((message) => {
      if (message.role !== 'user' && message.role !== 'assistant') return false
      return Boolean(textFromMessage(message))
    }).length
  }, [historyMessages])

  const historyError =
    historyQuery.error instanceof Error ? historyQuery.error.message : null
  const resolvedSessionKey = useMemo(() => {
    const key = historyQuery.data?.sessionKey
    if (typeof key === 'string' && key.trim().length > 0) {
      return key.trim()
    }
    return sessionKeyForHistory || 'main'
  }, [historyQuery.data?.sessionKey, sessionKeyForHistory])
  const activeCanonicalKey =
    resolvedSessionKey || sessionKeyForHistory || 'main'

  return {
    historyQuery,
    historyMessages,
    displayMessages,
    messageCount,
    historyError,
    resolvedSessionKey,
    activeCanonicalKey,
    sessionKeyForHistory,
  }
}

function mergeOptimisticHistoryMessages(
  serverMessages: Array<ChatMessage>,
  optimisticMessages: Array<ChatMessage>,
): Array<ChatMessage> {
  if (!optimisticMessages.length) return serverMessages

  const merged = [...serverMessages]
  const TEN_SECONDS = 10_000

  for (const optimisticMessage of optimisticMessages) {
    const optimisticClientId = getMessageClientId(optimisticMessage)
    const optimisticText = textFromMessage(optimisticMessage).trim()
    const optimisticAttachments = getAttachmentSignature(optimisticMessage)
    const optimisticTime = getMessageTimestamp(optimisticMessage)

    const matchingServerIndex = merged.findIndex((serverMessage) => {
      if (optimisticMessage.role && serverMessage.role) {
        if (optimisticMessage.role !== serverMessage.role) return false
      }

      const serverClientId = getMessageClientId(serverMessage)
      if (
        optimisticClientId &&
        serverClientId &&
        optimisticClientId === serverClientId
      ) {
        return true
      }

      const serverText = textFromMessage(serverMessage).trim()
      const serverAttachments = getAttachmentSignature(serverMessage)
      const serverTime = getMessageTimestamp(serverMessage)
      const withinWindow = Math.abs(optimisticTime - serverTime) <= TEN_SECONDS

      if (
        optimisticText &&
        serverText &&
        optimisticText === serverText &&
        withinWindow
      ) {
        return true
      }

      if (
        !optimisticText &&
        optimisticAttachments &&
        serverAttachments &&
        optimisticAttachments === serverAttachments &&
        withinWindow
      ) {
        return true
      }

      return false
    })

    if (matchingServerIndex >= 0) {
      const serverMessage = merged[matchingServerIndex]
      const serverHasAttachments =
        Array.isArray(serverMessage.attachments) &&
        serverMessage.attachments.length > 0
      const optimisticHasAttachments =
        Array.isArray(optimisticMessage.attachments) &&
        optimisticMessage.attachments.length > 0

      if (!serverHasAttachments && optimisticHasAttachments) {
        merged[matchingServerIndex] = {
          ...serverMessage,
          attachments: optimisticMessage.attachments,
        }
      }
      continue
    }

    // Preserve unconfirmed optimistic messages regardless of age.
    const isSending =
      optimisticMessage.status === 'sending' ||
      Boolean(optimisticMessage.__optimisticId)

    if (isSending) {
      merged.push(optimisticMessage)
    }
  }

  return merged
}

export function mergeCachedTailMessages(
  serverData: HistoryResponse,
  cachedMessages: Array<ChatMessage>,
): HistoryResponse {
  if (!cachedMessages.length) return serverData

  const serverMessages = Array.isArray(serverData.messages)
    ? serverData.messages
    : []
  const serverNewest = serverMessages.length
    ? Math.max(...serverMessages.map(getMessageTimestamp))
    : 0
  const cachedTail = cachedMessages.filter((cachedMessage) => {
    if (historyContainsMessage(serverMessages, cachedMessage)) return false
    if (isOptimisticUserMessage(cachedMessage)) return false
    const cachedTime = getMessageTimestamp(cachedMessage)
    if (cachedTime < serverNewest) return false
    const text = textFromMessage(cachedMessage).trim()
    if (!text && cachedMessage.role !== 'assistant') return false
    return cachedMessage.role === 'user' || cachedMessage.role === 'assistant'
  })

  if (!cachedTail.length) return serverData

  const messages = [...serverMessages, ...cachedTail]
  messages.sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b))

  return { ...serverData, messages }
}
