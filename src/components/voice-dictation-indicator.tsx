import Mic01Icon from '@hugeicons/core-free-icons/Mic01Icon'
import StopIcon from '@hugeicons/core-free-icons/StopIcon'
import { HugeiconsIcon } from '@hugeicons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchSessions, chatQueryKeys } from '@/screens/chat/chat-queries'
import type { SessionMeta } from '@/screens/chat/types'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useVoiceDictationStore } from '@/stores/voice-dictation-store'
import { Button } from '@/components/ui/button'

function resolveSessionLabel(
  friendlyId: string,
  sessions: Array<SessionMeta>,
): string {
  const session = sessions.find((item) => item.friendlyId === friendlyId)
  if (session) {
    const label = session.label?.trim() || session.title?.trim() || session.derivedTitle?.trim()
    if (label) return label
  }
  return friendlyId === 'new' ? 'New Chat' : friendlyId
}

function truncateSessionLabel(sessionLabel: string, maxLength = 42) {
  const trimmed = sessionLabel.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

function buildIndicatorLabel(
  status: 'recording' | 'transcribing',
  sessionLabel: string,
) {
  const visibleLabel = truncateSessionLabel(sessionLabel)
  if (status === 'transcribing') return `Transcribing for ${visibleLabel}`
  return `Recording for ${visibleLabel}`
}

export function VoiceDictationIndicator() {
  const navigate = useNavigate()
  const status = useVoiceDictationStore((state) => state.status)
  const source = useVoiceDictationStore((state) => state.source)
  const sessionsQuery = useQuery({
    queryKey: chatQueryKeys.sessions,
    queryFn: fetchSessions,
    staleTime: 10_000,
  })
  const setChatPanelOpen = useWorkspaceStore((state) => state.setChatPanelOpen)
  const setChatPanelSessionKey = useWorkspaceStore(
    (state) => state.setChatPanelSessionKey,
  )

  const visible =
    Boolean(source) && (status === 'recording' || status === 'transcribing')

  if (!visible || !source) return null

  const sessions = sessionsQuery.data ?? []
  const sessionLabel = resolveSessionLabel(source.friendlyId, sessions)
  const label = buildIndicatorLabel(status, sessionLabel)
  const fullLabel =
    status === 'transcribing'
      ? `Transcribing for ${sessionLabel}`
      : `Recording for ${sessionLabel}`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-22 right-6 z-50"
      >
        <Button
          type="button"
          onClick={() => {
            if (source.origin === 'chat-panel') {
              setChatPanelSessionKey(source.friendlyId)
              setChatPanelOpen(true)
              return
            }
            void navigate({
              to: '/chat/$sessionKey',
              params: { sessionKey: source.friendlyId || 'new' },
            })
          }}
          className="flex h-11 max-w-[min(34rem,calc(100vw-3rem))] items-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 text-red-700 shadow-lg hover:bg-red-100"
          aria-label={fullLabel}
          title={fullLabel}
        >
          <HugeiconsIcon
            icon={status === 'transcribing' ? StopIcon : Mic01Icon}
            size={18}
            strokeWidth={1.8}
            className={status === 'recording' ? 'animate-pulse' : ''}
          />
          <span className="truncate text-sm font-medium">{label}</span>
        </Button>
      </motion.div>
    </AnimatePresence>
  )
}
