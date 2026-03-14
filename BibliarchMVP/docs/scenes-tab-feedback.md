# Scenes Tab — Feedback & Ideas

## Feedback (Q&A)

---

### 1. Character Colors Render Incorrectly

**Problem:** Character colors don't match the Character Creator. Hair, skin, and clothing colors are wrong. Eyes especially don't load in properly.

**Why it's a problem:** Breaks visual consistency. Characters look different in scenes than in the creator, which destroys trust in the tool.

**Who struggles:** Everyone using scenes with characters.

**How to fix:** Scenes must use the **exact same shader pipeline** as the Character Creator (Viewer3D.tsx). Specifically:
- Same toon material (createColoredShadowMaterial)
- Same hair texture loading with undertone
- Same eye material handling (keep original FBX eye materials unchanged)
- Same color application logic for skin, hair, clothing

---

### 2. Pose List Shows Non-Existent Poses

**Problem:** The Scenes pose selector includes poses that don't exist in the Character Creator.

**Why it's a problem:** Selecting a fake pose either does nothing or causes errors. Confusing and broken.

**Who struggles:** Everyone making scenes.

**How to fix:** Scenes must reference the **exact same pose list** as the Character Creator. Single source of truth for available poses.

---

### 3. Facial Expressions — Not Ready Yet

**Current decision:** Leave as-is. Mouths, eyebrows, and expression controls will be added later when those assets are created in Blender.

**No action needed now.**

---

### 4. Dialogue Subtitles Have Unnecessary Styling

**Problem:** Subtitle boxes have padding/feet at the bottom. Too heavy visually.

**Why it's a problem:** Takes up space, looks clunky, distracts from the scene.

**Who struggles:** Story creators going for clean visual style.

**How to fix:** Switch to minimal style:
- White text
- Thin black outline (stroke)
- No box/background
- No feet/anchors

---

### 5. Can't Load Saved Locations as Backgrounds

**Problem:** Scenes can't load location backgrounds from the World Builder. There's no way to put a character in front of a place you built.

**Why it's a problem:** This is the core loop — build worlds, create characters, make scenes IN those worlds. Without background loading, scenes are disconnected from the world.

**Who struggles:** Everyone trying to tell stories in their worlds.

**How to fix:** Add a "Set Location" option in scene editing that:
- Lists saved world locations
- Renders the location as a 3D background behind the characters
- Or at minimum renders a screenshot/preview of the location as a 2D backdrop

---

### 6. Camera System Works Great

**Positive feedback:** Camera view functionality is working well. Love the camera controls.

**No action needed.**

---

### 7. Scene Functionality Overall

**Positive feedback:** The scene system itself works great functionally. Positioning, dialogue, camera — the core is solid. The main issues are visual consistency (shaders/colors) and missing integrations (locations, correct poses).

---

## Ideas — Claude

1. **Scene transition effects** — fade, cut, dissolve between scene panels
2. **Character emotion presets** — quick-select mood that adjusts pose + future expression
3. **Scene auto-layout** — select number of characters, auto-position them in common formations (conversation, confrontation, group)
4. **Dialogue auto-scroll preview** — play through all dialogue lines like a VN preview
5. **Scene duplication** — copy a scene as starting point for variations
6. **Background blur/depth of field** — focus on character, blur location behind
7. **Character spotlight/rim lighting** — per-character lighting adjustments for dramatic scenes
8. **Panel grid view** — see multiple scenes side by side like comic/manga panels
9. **Voice line placeholder** — attach audio clips to dialogue lines for future voiceover
10. **Scene mood lighting presets** — warm, cold, dramatic, romantic, horror — one-click atmosphere
11. **Character gaze direction** — point where a character is looking without changing full pose
12. **Props in scenes** — place objects (sword, book, cup) in character hands or scene
13. **Text styling per character** — each character's dialogue gets their signature color/font
14. **Scene bookmarks** — mark important scenes for quick navigation
15. **Export scene as image** — render a scene panel as a PNG for sharing
16. **Split-screen scenes** — show two locations simultaneously (phone call, parallel action)
17. **Weather/particle effects in scenes** — rain, snow, dust, sparkles as scene overlays
18. **Character shadow/silhouette mode** — dramatic reveal scenes where character is blacked out
19. **Scene notes** — attach private dev notes to scenes (plot reminders, continuity notes)
20. **Animated scene preview** — basic animation between keyframes (character walks in, turns, etc.)

---

## Ideas — ChatGPT

1. Auto-generated terrain tools (mountains, rivers) — as scene backgrounds
2. Story location tagging (important location, battle location, home)
3. World timeline events tied to scenes
4. Story mode camera tool (cinematic camera paths)
5. NPC crowd generator for background characters

*(ChatGPT's scene-specific ideas were limited — most were world-builder focused. The above are the relevant ones.)*

---

## Approved Ideas

*(Edit this section — keep the ones you like, remove the ones you don't.)*
