import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getTheme, setTheme } from '@/lib/theme'

export type SettingsThemeMode = 'system' | 'light' | 'dark'
export type AccentColor = 'orange' | 'purple' | 'blue' | 'green'

export type OpeningScreenMode = 'convon' | 'chat' | 'files'

export type StudioSettings = {
  hermesUrl: string
  hermesToken: string
  theme: SettingsThemeMode
  accentColor: AccentColor
  openingScreenMode: OpeningScreenMode
  openingConvoBoardId: string
  editorFontSize: number
  editorWordWrap: boolean
  editorMinimap: boolean
  notificationsEnabled: boolean
  usageThreshold: number
  smartSuggestionsEnabled: boolean
  preferredBudgetModel: string
  preferredPremiumModel: string
  onlySuggestCheaper: boolean
  showSystemMetricsFooter: boolean
  /** Mobile chat nav mode: 'dock' = iMessage (no nav in chat), 'integrated' = chat input in nav pill, 'scroll-hide' = nav shows on scroll up */
  mobileChatNavMode: 'dock' | 'integrated' | 'scroll-hide'
}

type SettingsState = {
  settings: StudioSettings
  updateSettings: (updates: Partial<StudioSettings>) => void
}

const OPENING_SCREEN_MODE_COOKIE = 'hermes-opening-screen-mode'
const OPENING_CONVON_BOARD_COOKIE = 'hermes-opening-convon-board'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

function syncOpeningScreenCookies(settings: StudioSettings) {
  writeCookie(OPENING_SCREEN_MODE_COOKIE, settings.openingScreenMode)
  if (settings.openingScreenMode === 'convon' && settings.openingConvoBoardId) {
    writeCookie(OPENING_CONVON_BOARD_COOKIE, settings.openingConvoBoardId)
  } else {
    clearCookie(OPENING_CONVON_BOARD_COOKIE)
  }
}

export const defaultStudioSettings: StudioSettings = {
  hermesUrl: '',
  hermesToken: '',
  theme: 'system',
  accentColor: 'blue',
  openingScreenMode: 'convon',
  openingConvoBoardId: '',
  editorFontSize: 13,
  editorWordWrap: true,
  editorMinimap: false,
  notificationsEnabled: true,
  usageThreshold: 80,
  smartSuggestionsEnabled: false,
  preferredBudgetModel: '',
  preferredPremiumModel: '',
  onlySuggestCheaper: false,
  showSystemMetricsFooter: false,
  mobileChatNavMode: 'dock',
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    function createSettingsStore(set) {
      return {
        settings: defaultStudioSettings,
        updateSettings: function updateSettings(updates) {
          set(function applyUpdates(state) {
            const nextSettings = {
              ...state.settings,
              ...updates,
            }
            syncOpeningScreenCookies(nextSettings)
            return {
              settings: nextSettings,
            }
          })
        },
      }
    },
    {
      name: 'hermes-settings',
      skipHydration: true,
    },
  ),
)

export function useSettings() {
  const settings = useSettingsStore(function selectSettings(state) {
    return state.settings
  })
  const updateSettings = useSettingsStore(function selectUpdateSettings(state) {
    return state.updateSettings
  })

  return {
    settings,
    updateSettings,
  }
}

export function resolveTheme(theme: SettingsThemeMode): 'light' | 'dark' {
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'

  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(_theme?: SettingsThemeMode) {
  setTheme(getTheme())
  document.documentElement.setAttribute('data-accent', 'orange')
}

export function initializeSettingsAppearance() {
  setTheme(getTheme())
  document.documentElement.setAttribute('data-accent', 'orange')
  void useSettingsStore.persist.rehydrate().then(() => {
    const settings = useSettingsStore.getState().settings
    syncOpeningScreenCookies(settings)
  })
}
