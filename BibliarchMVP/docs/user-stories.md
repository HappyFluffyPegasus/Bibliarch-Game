# Bibliarch — User Stories

> Extracted from creator interviews (February 2026).
> Each story follows the format: **As a [role], I want [capability] so that [benefit].**

---

## Homepage / Dashboard

**US-045** — As a user, I want story cards displayed as portrait-oriented rectangles (taller than wide, like book covers) with the title at the top and a short description below so that my project list looks clean and recognizable.

**US-046** — As a user, I want to upload a cover image for each story so that it displays like a book cover and I can visually identify my projects at a glance.

**US-047** — As a user, I want the description on story cards to be short (character-limited) so that the cards stay compact and don't have walls of text.

**US-048** — As a user, I do NOT want random accent colors assigned to my stories so that I'm not confused by colors I never chose.

---

## Scene System & AI Generation

**US-001** — As a user, I want to write notes about my story (characters, plot, world) in a notes tab so that the AI has full written context to generate scenes from.

**US-002** — As a user, I want to generate scenes by giving text prompts to the AI so that I can see my characters interacting on screen without needing any technical or 3D editing skills.

**US-003** — As a user, I want to link a scene to a timeline event so that the AI copies the context from that event (character states, relationships, plot points) and generates dialogue and actions that match.

**US-004** — As a user, I want to manually create scenes using a CapCut-style timeline editor so that I have full control over character actions, camera, and dialogue when I don't want AI involvement.

**US-005** — As a user, I want AI-generated scenes to appear in the same CapCut-style timeline so that I can edit them after generation if I want to adjust anything.

**US-006** — As a user, I want to save scenes so that I can rewatch them later, but saving should be optional — I don't have to keep every scene.

**US-007** — As a user, I want scenes to be 5–10 minutes long and generated as fast as possible so that I'm not waiting around.

**US-008** — As a user, I want the AI to write a script that the code translates into 3D character actions (e.g., "character moves 10px right and plays walk animation") so that scenes feel like watching a show, not reading text.

**US-009** — As a user, I want scene characters to interact with world objects that exist in my world (e.g., sitting on a bench in a park I built) so that scenes feel grounded in my world.

**US-049** — As a user, I want the scene list sidebar to be closed by default so that I see the 3D viewport first, not a sidebar.

**US-050** — As a user, I want the Scene Overview panel to be the primary way I browse my scenes because it looks great and is easy to navigate.

**US-051** — As a user, I want only one "New Scene" button (top-right corner of the scenes tab) so that I'm not confused by duplicate buttons.

**US-052** — As a user, I want exiting camera view to return me to my previous user camera position so that I don't lose my place after previewing the scene camera.

**US-053** — As a user, I do NOT need "Add Prop" in the scenes tab — remove it so the UI is cleaner.

**US-054** — As a user, I want the "Generate with AI" dialog to have readable text (not white on white) so that I can actually use it.

---

## Character System

**US-010** — As a user, I want a 3D character creator with asset-based customization (hair, clothes, skin tone, eye color) so that I can visually design my characters without needing modeling skills.

**US-011** — As a user, I want full color customization for hair, skin, and eyes so that my characters look exactly how I imagine them.

**US-012** — As a user, I want a hair undertone system with a texture picker so that hair doesn't look flat and I can choose undertones that complement my character's hair color.

**US-013** — As a user, I want to create, delete, and rename characters with a confirmation dialog on delete so that I don't accidentally lose a character.

**US-014** — As a developer, I want characters to animate without distortion when shape keys are applied so that facial expressions and body morphs don't break during animations.

**US-055** — As a user, I want creating a character in the Notes tab (character node) to automatically create a linked 3D character so that I don't have to manually create them in two places.

**US-056** — As a user, I want creating a 3D character to prompt me "Would you like to add this to the Notes tab as a note character?" so that I can keep my notes and 3D characters in sync.

**US-057** — As a user, I want to manually link a pre-existing 3D character to a pre-existing note character at any time so that if I created them separately I can still connect them later.

---

## Notes Tab

**US-015** — As a user, I want a Miro-like freeform canvas for note-taking so that I can place text boxes, plot points, and character notes anywhere without being confined to a linear document.

**US-016** — As a user, I want all personality fields and text boxes to be optional so that I can fill in only what I want — not every character or plot point is fully developed.

**US-017** — As a user, I want no word limits (or very large limits) on text fields so that I can describe things in as much detail as I want.

**US-018** — As a user, I want to import external text documents (.md, .txt, .docx) into the notes tab so that the AI can use my existing writing as reference without me having to retype everything.

**US-058** — As a user, I want the "Upload Master Doc" button to actually work so that I can import my existing documents.

**US-059** — As a user, I want an easy way to access and browse my uploaded master documents so that I can review what the AI has access to.

---

## Relationship System

**US-019** — As a user, I want relationships to have free-form text descriptions instead of preset labels (friend, enemy, etc.) so that I can capture the full nuance of how characters relate to each other.

**US-020** — As a user, I want one-sided relationships so that Character A can think positively of Character B while Character B thinks negatively of Character A.

**US-021** — As a user, I want relationship strength levels (1–3: weak, medium, strong) so that the AI understands whether a character has a mild dislike or an intense hatred, which directly affects how they act in generated scenes.

**US-022** — As a user, I want relationship states stored per timeline event so that the AI understands how character relationships change as the story progresses (e.g., friends who become enemies after a betrayal).

**US-023** — As a user, I want to visually see how relationships connect characters so that I can track the web of relationships across my story.

---

## Timeline System

**US-024** — As a user, I want a dedicated timeline tab (separate from the notes tab) with horizontal tracks like a video editing timeline so that I can organize events along parallel tracks representing different perspectives or timelines.

**US-025** — As a user, I want to place timeline blocks that I can move around, type in, and nest into sub-folders (arcs vs. single scenes) so that I can organize my story at different levels of detail.

**US-026** — As a user, I want to link timeline events to scenes so that clicking an event can take me to its associated scene, and generating a scene can reference its linked event.

**US-027** — As a user, I want to create a scene that doesn't yet have a timeline position so that I can generate it first and place it on the timeline later.

**US-060** — As a user, I want dragging events to always show visual feedback and actually work so that I'm not fighting the UI to rearrange my timeline.

**US-061** — As a user, I want events on the same track to be prevented from overlapping so that one event doesn't cover up another.

**US-062** — As a user, I want sub-event tracks to be independent from parent tracks so that deleting a track inside a sub-event doesn't accidentally delete a track in the parent timeline.

**US-063** — As a user, I want the "Add Event" button to have readable text (not white on white) so that I can see and use it.

---

## World Building

**US-028** — As a user, I want to build an open world with the same potential scale as Minecraft or Genshin Impact but with a building system like Blocksburg (Roblox) or The Sims 4 so that I can create detailed, explorable environments.

**US-029** — As a user, I want hierarchical world editing (World → Country → City → Building) so that I can work at different scales — shaping continents at the top level and placing furniture at the bottom level.

**US-030** — As a user, I want terrain edits at any level to propagate to all other levels (up and down) with smooth blending so that making a mountain taller on the city map also updates the world map without creating jarring edges.

**US-031** — As a user, I want to place lots for buildings so that I can duplicate buildings easily instead of rebuilding the same structure repeatedly.

**US-032** — As a user, I want characters to be at the correct scale relative to the world so that a character walking through a city actually feels like they're in a big world, not a tiny diorama.

**US-033** — As a user, I want a library of preset objects (buildings, decorations, props) that I can place into my world so that I don't need to model things from scratch.

**US-064** — As a user, I want a dedicated "Scaling Dummy" button (separate from the toolbox) that places a reference character model so that I can check whether my world is at the right scale.

**US-065** — As a user, I want a transform mode selector (Move / Scale / Rotate) with proper gizmo handles like Unity or Roblox Studio so that I can precisely manipulate objects with visual arrows, boxes, and rings.

**US-066** — As a user, I want the 2D minimap to always match the 3D terrain textures (grass shows as grass, water as water) so that the map is an accurate representation of my world.

**US-067** — As a user, I want the Environment tab to be fully functional so that I can adjust weather, lighting, and atmosphere.

**US-068** — As a user, I want all "Coming Soon" buttons to be replaced with working features so that nothing in the UI is a dead end.

**US-069** — As a user, I want the "Save Location" button to have readable text (not white on white) so that I can see and use it.

**US-073** — As a user, I want to see a real-time line preview as I place border points so that I know exactly what shape I'm drawing before I close the polygon.

**US-074** — As a user, I want borders to preserve the exact polygon shape I drew (triangles stay triangles, irregular shapes stay irregular) so that my regions actually match what I intended, not a bounding box.

**US-075** — As a user, I want the non-functional "Add Country" buttons removed from both the Explorer panel and the Regions area so that there are no dead-end buttons in the UI.

**US-076** — As a user, I want the Build tab ribbon to show all available tools (objects, regions, lots, roads, walls, doors, floors, furniture) organized in Roblox Studio-style groups so that I can actually access the build features.

**US-077** — As a user, I want to select multiple objects at once (shift-click, ctrl-click, or box/marquee select) so that I can delete, move, or duplicate groups of objects without clicking each one individually.

**US-078** — As a user, I want the objects dropdown/toolbox to show all available objects (scrollable or paginated) so that nothing is hidden or truncated.

**US-079** — As a user, I want hierarchy navigation (entering/exiting countries, cities, buildings) to complete in under 2 seconds so that I'm not waiting 20+ seconds every time I drill in or out.

**US-080** — As a user, I want terrain edits made at the world level to be visible when I enter a country within that region so that my mounds, valleys, and sculpting work is preserved across hierarchy levels.

**US-081** — As a user, I want the day/night lighting presets to affect the entire scene (sky, water, ambient light, and land together) so that going to "dark" doesn't just darken the land while the sky stays bright.

**US-082** — As a user, I want rain and snow particle effects to be visible at all zoom levels so that weather effects work during normal editing, not just when zoomed way out.

**US-083** — As a user, I want one unified fog control (remove the duplicate that does nothing) with adjustable density so that fog actually affects visibility.

**US-084** — As a user, I want cloudy weather to show visible cloud cover or haze so that the weather preset actually does something.

**US-085** — As a user, I want the sky color to automatically match the day/night cycle preset (not be a separate manual control) so that the environment settings aren't confusing and disconnected.

**US-086** — As a user, I want a "Terrain" entry in the Explorer tree that, when clicked, shows sculpt and paint brush tools in the Properties panel so that terrain editing follows the Roblox Studio Explorer → Properties paradigm.

**US-087** — As a user, I want clicking any object in the Explorer to show that object's properties in the Properties panel so that I can inspect and edit items from the tree, not just from clicking in the viewport.

**US-090** — As a user, I want the camera to start at a reasonable overview zoom when entering a country (not super zoomed in) so that I can see the region I'm working in.

**US-091** — As a user, I want terrain to never reset to a flat plane during hierarchy navigation so that my sculpting work is never lost by simply navigating between levels.

---

## UI/UX

**US-034** — As a user, I want the world building tab to have Roblox Studio-style UI with a ribbon toolbar and tabbed feature categories (terrain, building, play testing) so that features aren't crowded onto one screen.

**US-035** — As a user, I want the scenes tab to have a CapCut-style editing interface so that the workflow feels familiar to anyone who's edited video.

**US-036** — As a user, I want the notes tab to feel like Miro so that freeform note-taking is intuitive.

**US-037** — As a user, I want the character creator to look like a standard game character creator (centered view, side panels) so that it feels immediately familiar.

**US-038** — As a user, I want a unified color scheme and consistent aesthetic across all tabs so that the app feels cohesive even though each tab draws from different UI paradigms.

**US-070** — As a user, I want text and backgrounds to always have high contrast (at least 60–80% difference) so that I can read everything without straining or hovering.

**US-071** — As a user, I want button pairs (e.g., Cancel / Confirm) to both be styled correctly — never white text on a white background — so that I can always see and click both buttons.

**US-072** — As a user, I want dropdown menus to have readable text on a contrasting background so that I can see all my options.

---

## Master Documents

**US-039** — As a user, I want to upload existing text documents as "master documents" so that the AI can reference my external writing during scene generation without me reformatting it into the notes system.

**US-040** — As a user, I want multiple master documents per project so that I can import different source documents (worldbuilding guides, character sheets, plot outlines) separately.

---

## Demo Priority

**US-041** — As the creator, I want the AI scene generation to be the first demo feature because it best showcases what makes Bibliarch unique.

**US-042** — As the creator, I want the character creator and world builder to be the second demo features because they're the next most wanted capabilities from users.

---

## Item / Project Library

**US-088** — As a user, I want a Library panel where I can save objects or regions as reusable items, then place instances of those items into any hierarchy level (like Alight Motion's elements system) so that I can build a house once and reuse it across my world.

**US-089** — As a user, I want library items to support hierarchical composition (projects within projects) so that a city library item can contain house library items, and I can compose complex worlds from reusable parts.

---

## Items System (Deprecated)

**US-043** — As the creator, I want the Items tab deleted entirely — it is out of scope for the MVP.

---

## Aesthetic

**US-044** — As the creator, I want one unified aesthetic for the MVP, with customizable aesthetics (steampunk, Victorian, etc.) as a future feature, not a launch requirement.
