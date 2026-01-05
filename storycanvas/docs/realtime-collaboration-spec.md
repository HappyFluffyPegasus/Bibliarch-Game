# Real-Time Collaboration Specification

## Overview

Implement Google Docs-style real-time collaboration where multiple users can edit the same canvas simultaneously and see each other's changes instantly.

---

## Priority 1: Core Real-Time Functionality

### What Real-Time Means

When User A makes any change to the canvas, User B sees it instantly (within milliseconds) without refreshing or saving:
- Moving a node
- Creating a node
- Deleting a node
- Editing text in a node
- Drawing connections
- Deleting connections

### Current State

- **Infrastructure exists:** Supabase Broadcast channel, presence tracking (`usePresence`), `broadcastChange` function
- **Problem:** `broadcastChange` is never called when state changes
- **Current `onStateChange`:** Only updates `latestCanvasData.current` ref, doesn't broadcast

### Implementation Plan

#### Step 1: Broadcast on State Change

When `onStateChange` fires AND `othersPresent` is true:
```
onStateChange → update ref → broadcastChange(nodes, connections)
```

#### Step 2: Receive and Apply Remote Changes

When broadcast is received:
```
broadcast received → update local nodes/connections state → canvas re-renders
```

#### Step 3: Prevent Echo/Feedback Loop

When applying remote changes, don't re-broadcast them:
- Set flag before applying remote changes
- Check flag in onStateChange, skip broadcast if flag is set
- Clear flag after state update completes

#### Step 4: Continuous Auto-Save When Collaborating

When `othersPresent` is true:
- Debounce save every 1-2 seconds on state change
- This keeps database in sync so no "last save wins" conflict

### The "Last Save Wins" Problem

Without real-time:
1. User A makes changes (local only)
2. User B makes changes (local only)
3. User A navigates away → saves their version
4. User B navigates away → saves their version, **overwrites User A's work**

With real-time:
- Both users work on shared state
- Changes sync immediately
- Frequent auto-saves keep database current
- By the time anyone saves, canvas has everyone's work

---

## Priority 2: Edge Cases

### Edge Case 1: User Joins While Another Has Unsaved Changes

**Scenario:**
1. User A editing alone (no auto-save active)
2. User A has unsaved local changes
3. User B joins the canvas
4. User B loads stale data from database

**Solution:**
When `othersPresent` changes from `false` to `true`:
1. User A immediately saves current state to database
2. THEN enable broadcasting
3. User B's initial load gets User A's latest work

### Edge Case 2: Both Users Join Simultaneously

**Scenario:**
Both have empty/stale data, both try to save at same time.

**Solution:**
- First save wins
- Second user should refetch after brief delay before enabling broadcast

### Edge Case 3: User Leaves Mid-Session

**Scenario:**
User B leaves while User A is editing. `othersPresent` becomes false.

**Solution:**
- Stop broadcasting (save bandwidth)
- Keep auto-saving for a few seconds in case they return quickly
- Then revert to normal save behavior

### Edge Case 4: Network Disconnection

**Scenario:**
User A loses connection, keeps editing locally, reconnects. Their state may conflict with User B's saved changes.

**Solution:**
- On reconnect, fetch latest from database
- Either merge states or warn user of conflict

### Edge Case 5: Different Canvas/Subfolder Navigation

**Scenario:**
User A and B collaborating, User A navigates to a subfolder.

**Solution:**
- Each canvas has its own presence channel
- Navigation naturally separates them
- `othersPresent` becomes false on each canvas
- Should just work with current architecture

### Edge Case 6: Slow Network / Out of Order Messages

**Scenario:**
Broadcasts arrive late or out of order.

**Solution:**
- For node positions: last update wins (usually fine)
- For text: may need timestamps on operations
- Consider adding version numbers or timestamps to broadcasts

### Edge Case 7: Rapid Changes (Dragging)

**Scenario:**
User drags a node, broadcasting every pixel would flood the channel.

**Solution:**
- Throttle broadcasts during drag operations (every 50-100ms)
- Or only broadcast on drag end

---

## Technical Notes

### Existing Code Locations

- `src/lib/hooks/useCollaboration.ts` - `useRealtimeCanvas`, `usePresence`, `broadcastChange`
- `src/app/story/[id]/page.tsx` - `onStateChange`, `handleRemoteCanvasChange`, `othersPresent`
- `src/components/canvas/HTMLCanvas.tsx` - `remoteNodes`, `remoteConnections`, `onStateChange` callback

### Key Variables

- `othersPresent` - `Object.keys(presenceState).length > 0` (presence already filters out current user)
- `broadcastChange(nodes, connections)` - sends via Supabase Broadcast
- `handleRemoteCanvasChange` - receives broadcasts, updates canvas state

### Supabase Channels

- Presence: `presence:${storyId}:${canvasType}`
- Broadcast: `canvas-collab:${storyId}:${canvasType}`
