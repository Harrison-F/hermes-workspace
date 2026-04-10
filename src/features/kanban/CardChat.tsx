import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import SentIcon from '@hugeicons/core-free-icons/SentIcon'
import Loading03Icon from '@hugeicons/core-free-icons/Loading03Icon'
import { Button } from '@/components/ui/button'

interface Message {
  id: number
  session_id: string
  role: string
  content: string | null
  tool_call_id?: string | null
  tool_calls?: unknown[] | string | null
  tool_name?: string | null
  timestamp: number
  token_count?: number | null
  finish_reason?: string | null
}

interface CardChatProps {
  taskId: string
  taskTitle: string
  sessionId?: string
  onSessionCreated?: (sessionId: string) => void
}

export function CardChat({ taskId, taskTitle, sessionId, onSessionCreated }: CardChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState(sessionId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!currentSessionId) return
    try {
      const res = await fetch(`/api/kanban-tasks/${taskId}/session`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      // silent
    }
  }, [taskId, currentSessionId])

  useEffect(() => {
    setCurrentSessionId(sessionId)
  }, [sessionId])

  useEffect(() => {
    if (currentSessionId) {
      setLoading(true)
      fetchMessages().finally(() => setLoading(false))
    }
  }, [currentSessionId, fetchMessages])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Start chat — create session
  const handleStartChat = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/kanban-tasks/${taskId}/session`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create session' }))
        setError(err.error)
        return
      }
      const session = await res.json()
      setCurrentSessionId(session.id)
      onSessionCreated?.(session.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  // Send message
  const handleSend = async () => {
    if (!input.trim() || !currentSessionId || sending) return
    const msg = input.trim()
    setInput('')
    setSending(true)
    setError(null)

    // Optimistic: add user message
    const optimisticMsg: Message = {
      id: Date.now(),
      session_id: currentSessionId,
      role: 'user',
      content: msg,
      timestamp: Date.now() / 1000,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      // Use the Hermes API for chat (goes through env/config)
      const hermesApi = (window as unknown as { __HERMES_API?: string }).__HERMES_API || 'http://127.0.0.1:8642'
      const res = await fetch(`${hermesApi}/api/sessions/${currentSessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Chat failed' }))
        setError(err.error)
        return
      }
      // Refresh messages from server
      await fetchMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // No session — show start button
  if (!currentSessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          No chat session linked to this card.
        </p>
        <Button size="sm" onClick={handleStartChat} disabled={loading}>
          {loading ? 'Creating...' : 'Start Chat'}
        </Button>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 0 }}>
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin" style={{ color: 'var(--theme-muted)' }} />
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 px-3 py-2">
            <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" style={{ color: 'var(--theme-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--theme-muted)' }}>Working...</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-end gap-2 border-t p-3"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <textarea
          className="flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
            maxHeight: '120px',
          }}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          disabled={sending}
        />
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={!input.trim() || sending}
        >
          <HugeiconsIcon icon={SentIcon} size={16} />
        </Button>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const isAssistant = message.role === 'assistant'

  // Tool calls on assistant messages
  const toolCalls = isAssistant && message.tool_calls
    ? (typeof message.tool_calls === 'string'
      ? (() => { try { return JSON.parse(message.tool_calls as string) } catch { return null } })()
      : message.tool_calls)
    : null

  if (isTool) {
    return (
      <div className="mx-2">
        <div
          className="rounded-md border px-3 py-2 text-xs font-mono"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-muted)',
            background: 'var(--theme-bg)',
          }}
        >
          <div className="mb-1 text-[10px] font-semibold" style={{ color: 'var(--theme-accent, #60a5fa)' }}>
            {message.tool_name || 'tool result'}
          </div>
          <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
            {(message.content ?? '').slice(0, 500)}
            {(message.content ?? '').length > 500 && '...'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
        style={{
          background: isUser ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-surface, var(--theme-border))',
          color: isUser ? '#fff' : 'var(--theme-text)',
        }}
      >
        {/* Tool call pills */}
        {toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {toolCalls.map((tc: { id?: string; function?: { name?: string } }, i: number) => (
              <span
                key={tc.id || i}
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: isUser ? '#fff' : 'var(--theme-muted)',
                }}
              >
                🔧 {tc.function?.name || 'tool'}
              </span>
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div
          className="mt-1 text-right text-[10px]"
          style={{ opacity: 0.5 }}
        >
          {new Date(message.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
