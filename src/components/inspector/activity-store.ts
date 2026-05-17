import { create } from 'zustand'

export type ActivityEvent = {
  type: string
  time: string
  text: string
  phase?: string
  name?: string
  runId?: string
  sessionKey?: string
  details?: string
}

type ActivityState = {
  events: Array<ActivityEvent>
  push: (event: ActivityEvent) => void
  clear: () => void
}

const MAX_ACTIVITY_EVENTS = 500

function eventSignature(event: ActivityEvent): string {
  return [
    event.type,
    event.phase ?? '',
    event.name ?? '',
    event.runId ?? '',
    event.sessionKey ?? '',
    event.text,
    event.details ?? '',
  ].join('\u001f')
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  push: (event) =>
    set((state) => {
      const last = state.events[state.events.length - 1]
      if (last && eventSignature(last) === eventSignature(event)) {
        return state
      }
      return {
        events: [...state.events, event].slice(-MAX_ACTIVITY_EVENTS),
      }
    }),
  clear: () => set({ events: [] }),
}))

export function pushActivity(event: ActivityEvent) {
  useActivityStore.getState().push(event)
}
