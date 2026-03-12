# Bibliarch — Product Requirements (Interview-Derived)

> Requirements extracted from creator interviews (February 2026).
> These supplement the existing PRD (`prd.md`) with clarifications, corrections, and newly surfaced requirements.
> Priority is based on the creator's stated demo order: AI scenes first, character creator + world builder second.

---

## PR-001 – AI Scene Generation (Priority: Critical)

### Description
The AI writes a structured script from text prompts and/or linked timeline events. The code parses this script into 3D character actions rendered in real-time by the game engine. This is the #1 demo feature.

### How It Works
1. User writes story notes, creates characters, builds world, populates timeline
2. User enters scene generator and either:
   - Writes a text prompt describing the scene they want
   - Links to a timeline event so AI pulls context from it
   - Asks AI to "surprise me"
3. AI generates a script in a structured format the engine can parse (e.g., `character_move("Alice", 10, 0, 0)`, `character_play_animation("Alice", "walk")`, `character_say("Alice", "Hello!")`)
4. Engine plays back the script using the user's 3D characters in their world
5. Result appears in a CapCut-style timeline for optional editing
6. User can optionally save the scene for rewatching

### Requirements
- Scenes are 5–10 minutes long
- Generation should be as fast as possible
- AI context includes: notes, character metadata, relationship states, timeline events, master documents
- AI references the user's world (characters interact with objects that exist in the world — e.g., sitting on a bench)
- AI must respect character personalities, relationship dynamics, and timeline context
- Users need zero technical skill — everything is driven by text prompts
- Scenes are optionally saveable and rewatchable

### Key Constraints
- AI should NEVER give users direct story advice or tell them what to do (see `01-vision.md`)
- AI takes the newest information as fact when conflicts exist between sources

---

## PR-002 – Character Creator (Priority: High)

### Description
A 3D asset-based character creator where users select from pre-made assets (hair, clothes, accessories) and customize colors. No 3D modeling skills required.

### Requirements
- Full color customization: hair, skin tone, eye color (free color picker, not presets)
- Hair undertone system with texture picker (free commercial-use texture pack)
- Cel-shading with custom toon materials
- Character list management: create, delete, rename
- Confirmation dialog on delete
- Characters animate without distortion when shape keys are applied (skeleton utils clone approach for layered meshes)
- All character metadata (personality, backstory, traits) lives in the Notes tab, not the character creator

### Character ↔ Notes Linking
- Creating a character node in the Notes tab automatically creates a linked 3D character
- Creating a 3D character prompts the user: "Would you like to add this to the Notes tab as a note character?" (Yes / No)
- If the user says No, a button remains available to link later
- Pre-existing 3D characters and pre-existing note characters can be manually linked at any time
- Every 3D character should be linkable to exactly one note character and vice versa

### Known Issues
- Hair rigging problems with exported assets — hair can't be rigged as desired
- Clothes may have the same rigging export issues — needs a fix

---

## PR-003 – World Building (Priority: High)

### Description
Hierarchical world builder with terrain sculpting and a building system inspired by The Sims 4 / Blocksburg (Roblox).

### Requirements
- Hierarchical drill-down: World → Country → City → Building
- Terrain sculpting at any level propagates to all levels (up and down) with smooth blending
- Building system with lots (placeable, duplicatable building plots)
- Preset object library (buildings, decorations, props) — users place from a catalog
- Character-to-world scale must feel correct (characters walking in a city should feel like a real-scale city)
- Roblox Studio-style UI: ribbon toolbar with tabbed categories (terrain, building, objects, etc.)

### Scaling Dummy
- Dedicated button (separate from the toolbox) to place a reference character model
- Allows users to visually verify world scale at any hierarchy level
- Must be easy to find — not buried in a submenu

### Transform Gizmos
- Transform mode selector: Move / Scale / Rotate (like Unity or Roblox Studio)
- Move: directional arrows
- Scale: box handles
- Rotate: ring handles
- This is standard game engine behavior — the world builder should resemble making a map in Unity or Roblox Studio

### 2D Minimap Accuracy
- The 2D map must always correlate with the 3D terrain textures
- If terrain is painted as grass in 3D, the minimap shows grass
- Mismatches waste user time and erode trust

### Environment Tab
- Must be fully functional (currently broken)
- Controls: weather, lighting, atmosphere

### "Coming Soon" Buttons
- All must be replaced with working features — no dead-end UI

### Known Issues
- World map feels too small — scale needs significant adjustment
- UI layout is a persistent pain point for the creator
- "Save Location" button has white text on white background — must fix

---

## PR-004 – Notes Tab (Priority: Critical — Foundation)

### Description
Miro-like freeform canvas for all story writing. This is the foundation — the AI scene generator reads from notes for context. Already largely complete from the Bibliarch website.

### Requirements
- Freeform text boxes placeable anywhere on a canvas (not a linear document)
- All fields optional — characters, plot points, world details can be as sparse or detailed as the user wants
- No word limits (or very large limits)
- Covers: character metadata, plot points, world details, relationship descriptions
- Not just characters — everything story-related goes here
- Template system: provides starting prompts/fields the user can keep or remove

### Master Document Upload
- "Upload Master Doc" button must work (currently broken)
- After upload, users need an easy way to access and browse their master documents
- Documents stored as raw text — no formatting, no auto-parsing into structured fields

### Clarifications from Interview
- "Free-form text boxes" are NOT part of the character creator — they are part of the Notes tab
- The notes tab is the primary input surface for AI context
- This tab is considered mostly done (carried over from the Bibliarch website)

---

## PR-005 – Timeline Tab (Priority: High)

### Description
A dedicated tab (separate from notes) with a video-editing-style timeline for organizing story events.

### Requirements
- Horizontal tracks like a video editing timeline (think: audio track, video track)
- Timeline blocks that can be moved, typed into, and nested (arcs containing scenes)
- Linkable to scenes (bidirectional — event links to scene, scene links back to event)
- Scenes can be created without a timeline position and linked later
- Character states and relationship states stored per timeline event (for AI context)
- Multiple parallel tracks for simultaneous events from different perspectives

### Bug Fixes Required
- **Drag not working:** Dragging events sometimes doesn't respond or doesn't show visual feedback during drag — must always work and show the element moving
- **Event overlap:** Events on the same track can be placed on top of each other, covering each other up — must prevent overlap on the same track
- **Track scope leaking:** Tracks persist into sub-events — deleting a track inside a sub-event deletes it from the parent timeline, risking accidental data loss — sub-event tracks must be independent
- **"Add Event" button contrast:** White text on white background — must fix (see UI contrast rule)

### Clarifications from Interview
- There IS a timeline feature in the Notes tab, but the creator didn't like it — the dedicated Timeline tab is more structured
- Timeline tab is "half and half" — manual creation supported, but AI scene generation reads from it
- You cannot auto-generate a timeline node, but you CAN generate a scene and then link it to the timeline afterward

---

## PR-006 – Relationship System (Priority: Medium)

### Description
Nuanced relationship tracking between characters, supporting one-sidedness and free-form descriptions.

### Requirements
- Free-form text description (not preset labels like "friend"/"enemy")
- One-sided relationships: Character A → Character B can differ from Character B → Character A
- Strength levels: 1 (weak), 2 (medium), 3 (strong)
- Relationship states per timeline event (relationships evolve over time)
- Visual relationship chart showing connections
- All relationship data lives in the Notes tab
- Strength directly affects AI scene generation (mild dislike vs. intense hatred changes behavior)

### Clarifications from Interview
- "Relationship type" and "relationship state type" may be the same concept — the creator wasn't sure about the distinction
- Visualizing relationship evolution over time is desired but the creator is unsure how to make it look nice

---

## PR-007 – Master Document System (Priority: Medium)

### Description
Import external text documents so the AI can use them as reference material.

### Requirements
- Upload .md, .txt, .docx files
- Documents are NOT formatted or made pretty — they stay as raw text
- Documents are NOT auto-parsed into structured fields (no auto-populating character traits)
- Multiple master documents per project
- Purpose is purely for AI reference — gives the AI more context without the user retyping
- Supports export from the Bibliarch website for import here
- Upload button must work (currently broken)
- Users need an easy way to browse and access uploaded master docs

---

## PR-008 – UI/UX Paradigms (Priority: High)

### Description
Each tab draws from a different familiar UI paradigm, unified by a consistent color scheme.

### Requirements
| Tab | UI Paradigm | Reference |
|-----|-------------|-----------|
| World Building | Roblox Studio | Ribbon toolbar, tabbed feature categories, dockable panels |
| Scenes | CapCut | Video editing timeline, playback controls |
| Characters | Standard game character creator | Centered 3D view, side panels |
| Notes | Miro | Freeform canvas, drag-and-drop |
| Timeline | Video editing software | Horizontal tracks, draggable blocks |

- Blue color scheme matching the Bibliarch website brand
- One unified aesthetic for the MVP (customizable aesthetics are post-MVP)
- Navigation: currently a side menu (hamburger menu, top-left) — may switch to tabs
- UI placement inspired by references, not visual style (e.g., Roblox Studio's feature organization, not its rounded/sharp edge aesthetic)

### CRITICAL: Text Contrast Rule
**Never, under any circumstances, have white text on a white background or low-contrast text on any element.** This is the single most-cited UI issue. Specific violations found:
- "Add Event" button (Timeline tab)
- "Save Location" button (World tab)
- "Generate with AI" dialog (Scenes tab)
- Daylight cycle dropdown (Scenes tab) — white background with light blue text
- Various sub-tab labels in the Scenes area

**Rule:** Background and text must always have at least 60–80% contrast difference. This applies to:
- All buttons (especially button pairs where one is Cancel and one is Confirm)
- All dropdown menus
- All dialog text
- All labels and sub-tab text

---

## PR-009 – Items System (Priority: REMOVED)

### Status
**Delete the Items tab entirely.** It is out of scope for the MVP. The tab should not exist in the navigation.

---

## PR-010 – Scene Props & World Integration

### Description
Characters in scenes should interact with objects from the user's built world.

### Requirements
- If a scene takes place in a park the user built, and that park has a bench, the character can sit on the bench
- If there's no bench, the character doesn't sit on a bench
- Background elements come from the world builder, not from scene-specific prompts
- AI can equip items on characters that they don't normally have (e.g., "character holding a sword")
- "Add Prop" button in scenes tab is removed — props come from the world builder

---

## PR-011 – User Workflow & Time Distribution

### Description
There is no "correct" way to use Bibliarch. Different users will spend different amounts of time in each tab depending on their story and preferences.

### Design Implications
- Don't optimize for a single workflow — all tabs should be independently useful
- Some users will spend hours in world building, others will barely touch it
- Some users have extensive existing notes and will import them; others start from scratch
- The character creator can be quick (user knows their character) or lengthy (Sims-style customization)
- Timeline complexity varies wildly — from 3 events to hundreds

---

## PR-012 – Homepage / Dashboard (Priority: High)

### Description
The main landing page showing all the user's story projects.

### Requirements
- Story cards should be portrait-oriented (taller vertically than horizontally) — like book covers
- Title displayed at the top of each card
- Short description below the title (character-limited to keep cards compact)
- Users can upload a custom cover image that fills the card background
- No randomly assigned accent colors — remove the color bar system
- Cards should look like book covers on a shelf

### What to Remove
- The colored accent bar on the left side of each card
- The deterministic hash-based color system

---

## PR-013 – Scenes Tab Layout (Priority: High)

### Description
Scenes tab layout and UX fixes.

### Requirements
- Scene list sidebar should be closed by default (not open)
- When sidebar is closed, no blank space should remain — viewport fills the available area
- Scene Overview panel is the primary scene browser — keep it as-is
- Remove the "New Scene" button from the scene list sidebar — keep only the one in the top-right corner
- Remove "Add Prop" button entirely
- Camera view exit should return the user to their previous user camera position (not leave them at the scene camera position)
- Daylight dropdown must have readable text (not white/light blue on white)
- "Generate with AI" dialog must have readable text (not white on white)
