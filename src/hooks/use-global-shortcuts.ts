/**
 * Phase 3.1: Centralized global keyboard shortcuts
 * Handles Cmd/Ctrl+P, Cmd/Ctrl+B, Cmd/Ctrl+Shift+L
 */
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from '@/components/ui/toast'
import {
  getDebugBundlePayload,
  installDebugCollectors,
  buildDebugBundle,
  matchesDebugShortcut,
  recordDebugUiEvent,
} from '@/lib/debug-bundle'
import { writeTextToClipboard } from '@/lib/clipboard'
import { useSearchModal } from '@/hooks/use-search-modal'
import { useWorkspaceStore } from '@/stores/workspace-store'

function _isInputFocused(): boolean {
  const active = document.activeElement
  if (!active) return false
  const tag = active.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return true
  if ((active as HTMLElement).isContentEditable) return true
  return false
}

type ShortcutEvent = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function shouldFocusChatShortcut(event: ShortcutEvent): boolean {
  const mod = event.metaKey || event.ctrlKey
  return mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k'
}

// Sidebar toggle event — listened by the sidebar component
export const SIDEBAR_TOGGLE_EVENT = 'global:toggle-sidebar'

export function emitSidebarToggle() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLE_EVENT))
}

export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const openModal = useSearchModal((state) => state.openModal)
  const setScope = useSearchModal((state) => state.setScope)
  const toggleChatPanel = useWorkspaceStore((s) => s.toggleChatPanel)

  useEffect(() => {
    installDebugCollectors()
  }, [])

  useEffect(() => {
    async function copyDebugBundle() {
      const workspaceState = useWorkspaceStore.getState()
      const payload = getDebugBundlePayload({
        route: window.location.pathname,
        sessionKey: window.location.pathname.startsWith('/chat/')
          ? decodeURIComponent(window.location.pathname.replace('/chat/', ''))
          : workspaceState.chatPanelOpen
            ? workspaceState.chatPanelSessionKey
            : null,
        selectedMessageId: null,
        appVersion: import.meta.env.VITE_GIT_SHA || import.meta.env.MODE || 'dev',
        stateSnapshot: {
          sidebarCollapsed: workspaceState.sidebarCollapsed,
          fileExplorerCollapsed: workspaceState.fileExplorerCollapsed,
          chatPanelOpen: workspaceState.chatPanelOpen,
          chatPanelSessionKey: workspaceState.chatPanelSessionKey,
          activeSubPage: workspaceState.activeSubPage,
        },
      })
      await writeTextToClipboard(buildDebugBundle(payload))
      toast('Debug bundle copied', { type: 'success', icon: '🪵' })
      recordDebugUiEvent('Copied debug bundle hotkey')
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return

      const mod = event.metaKey || event.ctrlKey

      // Cmd/Ctrl+P — Quick open file
      if (mod && event.key.toLowerCase() === 'p' && !event.shiftKey) {
        event.preventDefault()
        setScope('files')
        openModal()
        return
      }

      // Cmd/Ctrl+B — Toggle sidebar
      if (mod && event.key.toLowerCase() === 'b' && !event.shiftKey) {
        event.preventDefault()
        emitSidebarToggle()
        return
      }

      // Cmd/Ctrl+J — Toggle chat panel
      if (mod && event.key.toLowerCase() === 'j' && !event.shiftKey) {
        event.preventDefault()
        toggleChatPanel()
        return
      }

      // Cmd/Ctrl+Shift+Alt+L — Copy debug bundle
      if (matchesDebugShortcut(event)) {
        event.preventDefault()
        void copyDebugBundle().catch((error) => {
          toast(
            error instanceof Error ? error.message : 'Failed to copy debug bundle',
            { type: 'error' },
          )
        })
        return
      }

      // Cmd/Ctrl+Shift+K — Focus chat workspace
      if (shouldFocusChatShortcut(event)) {
        event.preventDefault()
        void navigate({ to: '/chat' })
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, openModal, setScope, toggleChatPanel])
}

// Preserve for future input-focus checking
void _isInputFocused
