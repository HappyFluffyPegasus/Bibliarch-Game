# Collaborative Mode Issues Report

**Date:** December 8, 2025
**Branch:** `realtime-collaboration`
**Status:** Not deployed to production (main branch only has palette fix)

---

## Overview

The collaboration system has two main components:
1. **Invitation/Access Management** - Database-driven user permissions
2. **Real-time Sync** - Supabase Realtime Broadcast for live updates

This document outlines all known issues with the current implementation.

---

## Issue 1: Cursor Tracking Causing Unnecessary Load

**Severity:** Medium
**Fix Complexity:** Easy (remove feature)

### Location
- `src/lib/hooks/useCollaboration.ts` lines 606-648 (`updateCursor` function)
- `src/components/canvas/HTMLCanvas.tsx` lines 1469-1478 (cursor broadcast on every mouse move)
- `src/components/canvas/HTMLCanvas.tsx` lines 8779-8824 (cursor rendering)

### Problem
- Every mouse move calls `onCursorMove()` which broadcasts position via Supabase Presence
- Even with 100ms throttling, this creates ~10 presence updates/second per user
- Supabase Presence uses WebSockets, but still creates significant overhead
- The cursor rendering with CSS transitions adds DOM update overhead

### Impact
- Network spam
- Potential Supabase rate limits
- UI lag on lower-end devices

### Recommendation
Remove cursor tracking entirely. It provides minimal value compared to the performance cost.

---

## Issue 2: Text Content Doesn't Sync in Real-time

**Severity:** High
**Fix Complexity:** Hard

### Location
All `onBlur` handlers in `HTMLCanvas.tsx`:
- Line 5218 (text node content)
- Line 5381 (image header)
- Line 5601 (image caption)
- Line 6165 (node title)
- Line 6401+ (other text fields)

### Problem
Text only syncs when:
1. User clicks AWAY from the text field (blur event fires)
2. Then `handleSave()` is called
3. Then `onBroadcastChange()` broadcasts to other users

**What's missing:** No `onInput` handler that broadcasts while typing

### Why It's Hard to Fix
Previous attempts to add real-time text sync caused webpack errors because:
- Adding event handlers in the render cycle can cause React reconciliation issues
- The contentEditable elements have complex sanitization logic
- State updates during input can cause cursor position jumps

### Current Behavior
User A types "Hello World" → User B sees nothing until User A clicks elsewhere

---

## Issue 3: No Conflict Resolution (Last-Write-Wins)

**Severity:** High
**Fix Complexity:** Hard

### Location
`useRealtimeCanvas()` in `src/lib/hooks/useCollaboration.ts` lines 450-528

### Problem
```typescript
onRemoteChangeRef.current({
  nodes: payload.payload?.nodes || [],
  connections: payload.payload?.connections || [],
  userId: payload.payload?.userId || 'remote'
})
```

When remote changes come in, they completely **replace** the local state.

### Example Scenario
1. User A changes node title at t=0
2. User B moves the same node at t=1
3. User B's broadcast arrives at User A
4. User A loses their title change (replaced by User B's version)

### What's Missing
- No merging logic exists
- No operational transformation (OT)
- No conflict detection
- No conflict UI for manual resolution

---

## Issue 4: Presence Always Active (Even When Solo)

**Severity:** Low
**Fix Complexity:** Easy

### Location
`page.tsx` line 122

```typescript
const { presenceState, updateCursor, userColor } = usePresence(
  resolvedParams.id,
  currentCanvasId,
  username
)
```

### Problem
Presence channel is **always** subscribed, consuming WebSocket resources even when:
- User is the only one on the canvas
- Collaboration is not enabled for this story
- User is the story owner with no collaborators

### Recommendation
Only subscribe to presence when the story has collaborators, or lazy-subscribe when needed.

---

## Issue 5: No "Viewer" Mode Enforcement

**Severity:** Low
**Fix Complexity:** Medium

### Location
`useStoryAccess()` returns role but nothing enforces it

### Problem
The code tracks `role: 'editor' | 'viewer'` but:
- Viewers can still edit locally (UI doesn't disable editing)
- Viewers can still broadcast changes (no client-side check)
- No server-side enforcement of viewer restrictions in RLS policies for broadcasts

### Impact
A viewer could theoretically edit and their changes would broadcast/save.

### Recommendation
- Disable contentEditable fields for viewers
- Skip broadcast calls for viewers
- Add RLS policy to prevent viewer writes (currently only checks for canvas_data table)

---

## Issue 6: remoteUpdate State Can Cause Echo Loops

**Severity:** Medium
**Fix Complexity:** Medium

### Location
`page.tsx` handling of `remoteUpdate`

```typescript
const handleRemoteCanvasChange = useCallback((data) => {
  setRemoteUpdate({
    nodes: data.nodes,
    connections: data.connections
  })
  latestCanvasData.current = { nodes: data.nodes, connections: data.connections }
}, [])
```

### Problem
The `latestCanvasData.current` is updated with remote data. If the local user then makes a change:
1. Change triggers `handleSave()`
2. `handleSave()` broadcasts the state
3. But that state now includes the remote data that was just applied
4. This could create subtle merge issues or echo effects

### Current Mitigation
The `userId` filtering prevents processing your own broadcasts, but the state merging is still imperfect.

---

## Issue 7: No Offline/Reconnect Handling

**Severity:** Low
**Fix Complexity:** Hard

### Location
`useRealtimeCanvas()` subscription in `useCollaboration.ts`

### Problem
If WebSocket disconnects:
- No automatic reconnection logic beyond Supabase's built-in retry
- No queue of pending changes made while offline
- User might think they're syncing when they're not
- No visual indicator of connection status

### Impact
- Changes made during brief disconnects may be lost
- User has no way to know if sync is working
- No graceful degradation to offline mode

---

## Summary Table

| Issue | Severity | Fix Complexity | Recommendation |
|-------|----------|----------------|----------------|
| 1. Cursor tracking overhead | Medium | Easy | Remove entirely |
| 2. Text doesn't sync real-time | High | Hard | Research CRDT/OT solutions |
| 3. No conflict resolution | High | Hard | Implement node-level merging |
| 4. Presence always active | Low | Easy | Lazy subscribe |
| 5. No viewer enforcement | Low | Medium | Disable editing UI for viewers |
| 6. Potential echo loops | Medium | Medium | Improve state isolation |
| 7. No offline handling | Low | Hard | Add connection status indicator |

---

## Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User A's Browser                         │
├─────────────────────────────────────────────────────────────────┤
│  page.tsx                                                        │
│  ├── usePresence() ──────────────────┐                          │
│  │   - Tracks who's online           │                          │
│  │   - Updates cursor position       │                          │
│  │                                   ▼                          │
│  ├── useRealtimeCanvas() ◄───── Supabase Broadcast Channel      │
│  │   - Receives remote changes       │                          │
│  │   - Calls broadcastChange()       │                          │
│  │                                   │                          │
│  └── HTMLCanvas                      │                          │
│      ├── handleSave() ───────────────┼──► onBroadcastChange()   │
│      │   - Saves to DB               │                          │
│      │   - Triggers broadcast        │                          │
│      │                               │                          │
│      └── Renders collaborator        │                          │
│          cursors from presenceState  │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
                    Supabase Realtime  │
                    ┌──────────────────┴──────────────────┐
                    │  Channel: canvas-collab:{id}:{type} │
                    │  Channel: presence:{id}:{type}      │
                    └──────────────────┬──────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────┐
│                         User B's Browser                         │
│                         (Same structure)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Required)

The collaboration system requires running `supabase-collaboration-schema.sql` which creates:

- `story_collaborators` table - tracks who has access
- `share_tokens` table - for shareable invite links
- RLS policies for access control
- `accept_share_invite()` function for token-based joining

---

## Files Involved

| File | Purpose |
|------|---------|
| `src/lib/hooks/useCollaboration.ts` | All collaboration hooks |
| `src/components/collaboration/ShareDialog.tsx` | Share UI for owners |
| `src/components/collaboration/InvitationsInbox.tsx` | Pending invites UI |
| `src/app/story/[id]/page.tsx` | Integration point |
| `src/components/canvas/HTMLCanvas.tsx` | Canvas with collab props |
| `supabase-collaboration-schema.sql` | Database setup |

---

## Solutions

### Solution 1: Remove Cursor Tracking

**Approach:**
1. Remove `onCursorMove` prop from HTMLCanvas interface and component
2. Remove cursor broadcast code from `handlePointerMove` in HTMLCanvas
3. Remove `updateCursor` function and cursor-related code from `usePresence()` hook
4. Remove the collaborator cursor rendering JSX (the SVG arrows with username labels)
5. Keep presence tracking for "who's online" but without cursor positions

**Files to modify:**
- `HTMLCanvas.tsx` - Remove cursor broadcast and rendering
- `useCollaboration.ts` - Simplify `usePresence()` to not track cursors
- `page.tsx` - Remove `onCursorMove` prop passing

---

### Solution 2: Text Content Real-time Sync

**Approach:**
Instead of trying to sync on every keystroke (which caused webpack errors), implement **selection-based sync**:

1. When user selects a different node, broadcast the previous node's final text state
2. Add a debounced broadcast (e.g., 500ms after typing stops) that syncs text without full save
3. Create a lightweight `broadcastTextChange(nodeId, field, value)` function separate from full canvas broadcast

**Alternative (if above fails):**
Add a "Sync" indicator that shows when text is pending sync, and sync on blur (current behavior) but make it more obvious to users.

**Files to modify:**
- `HTMLCanvas.tsx` - Add debounced text broadcast
- `useCollaboration.ts` - Add `broadcastTextChange` to `useRealtimeCanvas`
- `page.tsx` - Handle incoming text-only updates

---

### Solution 3: Conflict Resolution (Node-Level Merging)

**Approach:**
Implement **node-level merging** instead of full canvas replacement:

1. Each broadcast includes a `changedNodeIds` array
2. When receiving remote changes, only update the specific nodes that changed
3. For the same node edited by both users:
   - Position changes: last-write-wins (acceptable)
   - Text changes: last-write-wins with timestamp comparison
   - Add visual indicator when a node was remotely modified

**Code Example:**
```typescript
// Instead of replacing all nodes:
setNodes(remoteNodes)

// Merge by node ID:
setNodes(prev => {
  const remoteMap = new Map(remoteNodes.map(n => [n.id, n]))
  return prev.map(node => {
    if (changedNodeIds.includes(node.id)) {
      return remoteMap.get(node.id) || node
    }
    return node
  })
})
```

**Files to modify:**
- `useCollaboration.ts` - Change broadcast payload structure
- `HTMLCanvas.tsx` - Track which nodes changed
- `page.tsx` - Implement merge logic in `handleRemoteCanvasChange`

---

### Solution 4: Lazy Presence Subscription

**Approach:**
Only subscribe to presence when collaboration is relevant:

1. Check if story has collaborators before subscribing
2. Lazy-initialize presence channel on first detected collaborator
3. Add `enabled` flag to `usePresence()` hook

**Code Example:**
```typescript
// In page.tsx
const hasCollaborators = storyAccess?.isOwner
  ? collaborators.length > 0
  : true // Collaborators always need presence

const { presenceState } = usePresence(
  hasCollaborators ? storyId : null,  // null = don't subscribe
  canvasType,
  username
)
```

**Files to modify:**
- `useCollaboration.ts` - Add conditional subscription
- `page.tsx` - Add collaborator check before enabling presence

---

### Solution 5: Viewer Mode Enforcement

**Approach:**
1. Pass `isViewer` prop to HTMLCanvas
2. Disable all editing interactions when `isViewer` is true:
   - Make contentEditable fields read-only
   - Disable node creation tools
   - Disable delete/move/resize
   - Hide edit-related UI
3. Skip broadcast calls for viewers

**Code Example:**
```typescript
// In HTMLCanvas
const canEdit = !isViewer

// For contentEditable
contentEditable={canEdit && editingField?.nodeId === node.id}

// For tools
{canEdit && <ToolbarButton ... />}
```

**Files to modify:**
- `HTMLCanvas.tsx` - Add `isViewer` prop, conditionally disable editing
- `page.tsx` - Pass `isViewer={storyAccess?.role === 'viewer'}`

---

### Solution 6: Echo Loop Prevention

**Approach:**
1. Add version/timestamp to each broadcast
2. Track last applied remote version
3. Don't re-broadcast state that came from remote
4. Separate local state from remote state more clearly

**Code Example:**
```typescript
const [localChanges, setLocalChanges] = useState<Set<string>>(new Set())

const handleRemoteCanvasChange = (data) => {
  // Mark these as remote, not local
  isApplyingRemoteChange.current = true

  // Apply remote changes
  setRemoteUpdate(data)

  // Clear flag after React processes the update
  requestAnimationFrame(() => {
    isApplyingRemoteChange.current = false
  })
}

const handleSave = (nodes, connections) => {
  // Don't broadcast if we're applying remote changes
  if (isApplyingRemoteChange.current) return

  // ... rest of save logic
}
```

**Files to modify:**
- `page.tsx` - Better state isolation
- `HTMLCanvas.tsx` - Pass through remote change flag

---

### Solution 7: Connection Status Indicator

**Approach:**
1. Track WebSocket connection state in `useRealtimeCanvas`
2. Return `connectionStatus: 'connected' | 'connecting' | 'disconnected'`
3. Show indicator in UI (green dot = connected, yellow = connecting, red = disconnected)
4. Queue changes made while disconnected, replay on reconnect

**Code Example:**
```typescript
// In useRealtimeCanvas
const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting')

channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') setConnectionStatus('connected')
  else if (status === 'CLOSED') setConnectionStatus('disconnected')
  else setConnectionStatus('connecting')
})

return { broadcastChange, connectionStatus }
```

**UI in page.tsx header:**
```tsx
{connectionStatus === 'connected' && <Cloud className="text-green-500" />}
{connectionStatus === 'connecting' && <Loader2 className="animate-spin text-yellow-500" />}
{connectionStatus === 'disconnected' && <CloudOff className="text-red-500" />}
```

**Files to modify:**
- `useCollaboration.ts` - Track and return connection status
- `page.tsx` - Display status indicator

---

## Implementation Order

Recommended order (easiest/highest-impact first):

| Priority | Issue |
|----------|-------|
| 1 | Remove cursor tracking |
| 2 | Lazy presence subscription |
| 3 | Connection status indicator |
| 4 | Viewer mode enforcement |
| 5 | Echo loop prevention |
| 6 | Node-level merging |
| 7 | Text sync improvements |

---

## Next Steps (Recommended Priority)

1. **Remove cursor tracking** - Easy win, removes Issue 1 entirely
2. **Add connection status indicator** - User feedback for Issue 7
3. **Research CRDT libraries** - For Issues 2 and 3 (Yjs, Automerge)
4. **Implement viewer mode** - Fixes Issue 5
