# Collaborative Mode Issues Report

**Date:** December 9, 2025
**Branch:** `main`
**Status:** In development

---

## Overview

The collaboration system has two main components:
1. **Invitation/Access Management** - Database-driven user permissions
2. **Real-time Sync** - Supabase Realtime Broadcast for live updates

This document outlines all known issues and their current status.

---

## Fixed Issues

### Issue 1: Cursor Tracking Causing Unnecessary Load - FIXED

**Status:** Removed entirely

Cursor tracking was removed from the collaboration system. The presence system now only tracks who is online without broadcasting cursor positions.

---

### Issue 4: Presence Always Active (Even When Solo) - FIXED

**Status:** Simplified

Presence now only tracks online users without cursor overhead. The broadcast channel stays connected for real-time sync.

---

### Issue 5: No "Viewer" Mode Enforcement - FIXED (Removed)

**Status:** Viewer mode removed entirely

Viewer mode was causing canvas blanking issues when viewers joined. The entire viewer role has been removed:
- Share dialog only offers "Editor" role
- Invitations inbox always shows "Editor"
- `isViewer` is hardcoded to `false` in page.tsx

---

### Issue 7: No Offline/Reconnect Handling - PARTIALLY FIXED

**Status:** Connection indicator added

- Added connection status indicator (bottom right corner of canvas)
- Shows "Live" with green icon when connected
- Shows "Connecting..." with spinner when reconnecting
- Supabase handles automatic reconnection

**Still missing:**
- Queue of pending changes made while offline
- Replay on reconnect

---

## Remaining Issues

### Issue 8: Decline Invitation Button Not Working

**Severity:** Low
**Fix Complexity:** Easy (requires database change)

The X button to decline invitations in the InvitationsInbox doesn't work. The RLS policy only allows story owners to delete collaborator records, not users to decline their own invitations.

**Required Fix:**
Run this SQL in Supabase dashboard:
```sql
CREATE POLICY "Users can decline their own invitations"
  ON public.story_collaborators FOR DELETE
  USING (user_id = auth.uid());
```

---

### Issue 9: Collaborator Names Were Showing "Unknown User" (FIXED)

**Status:** Fixed

The Supabase query was using incorrect foreign key join syntax. Changed from `profiles:user_id` to `profile:profiles!user_id` in the collaborators query.

---

### Issue 10: Node Locking for Concurrent Editing (FIXED)

**Status:** Fixed (December 11, 2025)

Implemented node-level locking to prevent two users from editing the same node simultaneously.

**How it works:**
- When User A starts editing a node (double-click/focus), a lock broadcast is sent
- User B sees the node with a red ring, red border, and "Username is editing" badge
- User B cannot edit that node while it's locked
- When User A stops editing (blur), an unlock broadcast is sent
- If User A disconnects, the lock is automatically released (presence-based cleanup)

**Files modified:**
- `src/lib/hooks/useCollaboration.ts` - Added lock/unlock broadcast functions and listeners
- `src/app/story/[id]/page.tsx` - Added lockedNodes state, handlers, and auto-unlock on disconnect
- `src/components/canvas/HTMLCanvas.tsx` - Added lock indicator UI for all node types

---

## Summary Table

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| 1. Cursor tracking overhead | Medium | FIXED | Removed entirely |
| 2. Text doesn't sync real-time | High | FIXED | Node locking prevents conflicts |
| 3. No conflict resolution | High | FIXED | Node locking prevents conflicts |
| 4. Presence always active | Low | FIXED | Simplified |
| 5. No viewer enforcement | Low | FIXED | Removed viewer mode |
| 6. Potential echo loops | Medium | FIXED | Improved with isApplyingRemoteChange |
| 7. No offline handling | Low | Partial | Added connection indicator |
| 8. Decline invitation broken | Low | Open | Needs RLS policy |
| 9. Unknown User names | Medium | FIXED | Query syntax fixed |
| 10. Concurrent editing conflicts | High | FIXED | Node locking implemented |

---

## Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User A's Browser                         │
├─────────────────────────────────────────────────────────────────┤
│  page.tsx                                                        │
│  ├── usePresence() ──────────────────┐                          │
│  │   - Tracks who's online           │                          │
│  │   - Auto-unlocks on user leave    │                          │
│  │                                   ▼                          │
│  ├── useRealtimeCanvas() ◄───── Supabase Broadcast Channel      │
│  │   - Receives remote changes       │                          │
│  │   - Returns connectionStatus      │                          │
│  │   - broadcastChange()             │                          │
│  │   - broadcastNodeLock()           │                          │
│  │   - broadcastNodeUnlock()         │                          │
│  │                                   │                          │
│  ├── lockedNodes state               │                          │
│  │   - Tracks nodes locked by others │                          │
│  │                                   │                          │
│  └── HTMLCanvas                      │                          │
│      ├── handleSave() ───────────────┼──► onBroadcastChange()   │
│      │   - Saves to DB               │                          │
│      │   - Triggers broadcast        │                          │
│      │                               │                          │
│      ├── setEditingField()           │                          │
│      │   - Broadcasts lock on focus  │                          │
│      │   - Broadcasts unlock on blur │                          │
│      │   - Prevents editing locked   │                          │
│      │                               │                          │
│      ├── Lock indicator UI           │                          │
│      │   - Red ring on locked nodes  │                          │
│      │   - "User is editing" badge   │                          │
│      │                               │                          │
│      └── Connection indicator        │                          │
│          (bottom right corner)       │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
                    Supabase Realtime  │
                    ┌──────────────────┴──────────────────┐
                    │  Channel: canvas-collab:{id}:{type} │
                    │  Events: canvas-update, node-lock,  │
                    │          node-unlock                │
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

## Files Modified

| File | Changes Made |
|------|--------------|
| `src/lib/hooks/useCollaboration.ts` | Fixed collaborator query, simplified broadcast logic, removed cursor tracking, added node lock/unlock broadcasts |
| `src/components/collaboration/ShareDialog.tsx` | Removed viewer role dropdown |
| `src/components/collaboration/InvitationsInbox.tsx` | Always shows Editor role |
| `src/app/story/[id]/page.tsx` | Disabled viewer mode, simplified broadcast handling, added lockedNodes state, auto-unlock on presence leave |
| `src/components/canvas/HTMLCanvas.tsx` | Added connection indicator, removed cursor rendering, added lock indicator UI for all node types, wrapped setEditingField with lock/unlock logic |

---

## Next Steps (Recommended Priority)

1. **Fix decline invitation** - Add RLS policy in Supabase dashboard (Issue 8)
2. **Add offline queue** - Complete Issue 7 fix (queue changes while offline, replay on reconnect)
