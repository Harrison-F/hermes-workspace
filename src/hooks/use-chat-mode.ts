import { useQuery } from '@tanstack/react-query'

export type ChatMode = 'enhanced-hermes' | 'workspace-local' | 'portable' | 'disconnected'

interface GatewayStatus {
  capabilities: Record<string, boolean>
  hermesUrl: string
}

interface SessionsStatus {
  source?: string
}

function deriveChatMode(
  capabilities: Record<string, boolean>,
  sessionsSource?: string,
): ChatMode {
  if (capabilities.sessions) return 'enhanced-hermes'
  if (sessionsSource === 'workspace-local') return 'workspace-local'
  if (capabilities.chatCompletions || capabilities.health) return 'portable'
  return 'disconnected'
}

export function useChatMode(): ChatMode {
  const { data } = useQuery({
    queryKey: ['gateway-status', 'chat-mode'],
    queryFn: async () => {
      const [gatewayRes, sessionsRes] = await Promise.all([
        fetch('/api/gateway-status'),
        fetch('/api/sessions'),
      ])

      const gateway = gatewayRes.ok
        ? ((await gatewayRes.json()) as GatewayStatus)
        : null
      const sessions = sessionsRes.ok
        ? ((await sessionsRes.json()) as SessionsStatus)
        : null

      return {
        gateway,
        sessionsSource: sessions?.source,
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  if (!data?.gateway?.capabilities) return 'disconnected'
  return deriveChatMode(data.gateway.capabilities, data.sessionsSource)
}
