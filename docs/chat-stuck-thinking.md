# Hermes Workspace — Chat stuck on “Thinking…”

This document tracks the recurring Hermes Workspace bug where chat can appear stuck on “Thinking…” after or during a response.

## Scope

This issue has shown up in multiple forms:

1. Response-visible lingering state
- The assistant response is already visible in chat
- The UI still shows a lingering “Thinking…” bubble
- The main panel may still have `chat-streaming-glow`

2. Immediate-on-open stale state
- Opening a session can show “Thinking…” immediately
- No real in-flight response is visible
- Often looks like a fresh session with stale client runtime state

3. Same-tab vs fresh-tab split
- A stuck session in an already-open tab can still show “Thinking…”
- Opening the exact same session URL in a fresh tab renders cleanly
- This indicates a client runtime/state issue rather than backend/session data corruption

## Canonical environment mapping

For Harrison’s setup:

- Installed Brave/Tailscale URL:
  - `https://harrisons-macbook-air.tail323ae0.ts.net:10000`
- Tailscale Serve proxy target:
  - `http://127.0.0.1:3002`
- Real target instance for Brave installed app behavior:
  - `3002`
- Separate local dev instance may run on:
  - `3000`

Important rule:
- If the bug is reported from the installed Brave app, treat `3002` as canonical.
- Do not assume fixes verified only on `3000` apply to the installed app unless the serving instance is confirmed.

## What was confirmed

- The installed Brave app and local dev port `3000` were not the same instance.
- Fresh loads of the same stuck session URL on `:10000` / `3002` rendered cleanly.
- That means backend/session state was not the primary remaining issue once the main fixes landed.
- The residual issue was narrowed to active-tab client runtime behavior.

## Root causes found so far

### 1. Internal control messages retriggered waiting state
File:
- `src/screens/chat/hooks/use-realtime-chat-history.ts`

Problem:
- Internal control/user-like messages (memory flush, compaction/system prompts, queued announcements, etc.) still flowed into `onUserMessage`
- Chat screen treated them like real external user messages
- This retriggered `waitingForResponse` / `pendingGeneration`

Fix:
- Added filtering for internal control messages before they can trigger chat waiting state

### 2. Pending-send cleanup was incomplete
Files:
- `src/screens/chat/chat-screen.tsx`
- `src/screens/chat/pending-send.ts`

Problem:
- Completion/error paths did not always clear pending state strongly enough
- That let waiting state survive longer than the real response lifecycle

Fix:
- Hardened cleanup on complete/error/finish paths
- Reset pending state when the stream ends

### 3. “Assistant appeared” baseline was overwritten every render
File:
- `src/screens/chat/chat-screen.tsx`

Problem:
- The logic intended to detect “a new assistant response appeared, clear waiting” kept re-capturing its own baseline while still waiting
- By the time the response rendered, the baseline had drifted and the transition was missed

Fix:
- Capture that waiting snapshot once per waiting cycle, not continuously

### 4. Session-reset path could restore waiting from stale in-memory flags alone
File:
- `src/screens/chat/chat-screen.tsx`

Problem:
- On session change/open, `waitingForResponse` could be restored from `hasPendingSend()` / `hasPendingGeneration()` even when there was no actual persisted pending message for the current session
- This produced “Thinking…” immediately on open

Fix:
- Only restore waiting state if a real persisted pending payload exists for the current session
- Otherwise clear stale in-memory pending state

### 5. Streaming state could outlive the visible response handoff
Files:
- `src/screens/chat/hooks/use-streaming-message.ts`
- `src/stores/chat-store.ts`

Problem:
- Store/local streaming state was sometimes kept alive beyond the point where the final assistant message was already visible

Fix:
- Clear streaming state explicitly on finish/done paths
- Preserve final tool/message data without leaving stale streaming state active

## Primary files involved

- `src/screens/chat/chat-screen.tsx`
- `src/screens/chat/components/chat-message-list.tsx`
- `src/screens/chat/hooks/use-realtime-chat-history.ts`
- `src/screens/chat/hooks/use-streaming-message.ts`
- `src/screens/chat/pending-send.ts`
- `src/stores/chat-store.ts`

## Tests added / relevant

- `src/screens/chat/chat-screen-stuck-thinking.test.ts`
- `src/screens/chat/pending-send.test.ts`
- `src/screens/chat/hooks/use-realtime-chat-history.test.ts`
- `src/screens/chat/hooks/use-streaming-message.test.tsx`
- `src/stores/chat-store.test.ts`

## How to diagnose correctly

### A. First confirm the instance
If the report comes from Brave installed app:
- test on `:10000`
- remember it maps to local `3002`

### B. Compare same-tab vs fresh-tab behavior
Ask:
- Does the stuck session render cleanly in a fresh tab?

If yes:
- suspect active-tab client runtime state
- do not blame backend/session persistence first

If no:
- inspect live server/session state more aggressively

### C. Check for three distinct state classes
1. `waitingForResponse` stuck true
2. stale pending-send / pending-generation state
3. stale streaming state / derived streaming UI state

### D. Distinguish visual UX grace from real stuck state
Some “Thinking…” display is expected briefly because of grace-period UX in `chat-message-list.tsx`.
A real bug is when:
- the response is already stably visible, or
- the session is freshly opened with no actual in-flight work,
- and the “Thinking…” state persists anyway.

## Current interpretation

At the time this document was written:
- The major app-side causes above had already been patched.
- Fresh reloads of affected sessions on `:10000` / `3002` were clean.
- The only remaining reports pointed to same-tab active runtime behavior, not backend/session data.

## Operational rule for future debugging

When this issue comes back:
1. Verify whether the report is from `3002` or only from separate local dev on `3000`
2. Reproduce on the canonical instance first
3. Compare fresh-tab rendering against same-tab rendering
4. Only then decide whether the problem is:
   - backend/session state
   - stale pending state
   - stale streaming state
   - or tab-local client runtime state
