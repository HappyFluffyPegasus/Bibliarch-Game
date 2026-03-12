# Bibliarch MVP — Product Requirements Document

> This document defines all requirements for the Bibliarch MVP rewrite.
> Each requirement maps to a GitHub issue with the `prd` label.
> Ralph picks the lowest-numbered open issue each iteration.

---

## REQ-001 – State Management Architecture

**Status:** not passing
**Priority:** 10

### Description
Rewrite Zustand stores (storyStore.ts, worldBuilderStore.ts) with clean architecture. Separate concerns: one store per domain, proper TypeScript typing, normalized data (no deeply nested objects), proper action naming, error handling, and optimistic updates. Remove any god-object patterns. Ensure localStorage persist still works with the new shape. Migration logic for existing data.

### Acceptance Criteria
- [ ] npm run build succeeds with zero TypeScript errors
- [ ] Each domain (stories, characters, timeline, scenes, world, items) has its own clearly scoped store or store slice
- [ ] All store actions are properly typed with input/output types
- [ ] Data is normalized — no arrays-inside-objects that require scanning to find items by ID
- [ ] Existing localStorage data is migrated automatically on first load (no data loss)
- [ ] npm run lint passes with zero warnings

## REQ-002 – UI Component Library

**Status:** not passing
**Priority:** 20

### Description
Audit and polish all shared shadcn/ui components in src/components/ui/. Ensure consistent theming (blue scheme), proper accessibility (ARIA labels, keyboard navigation, focus rings), consistent spacing/sizing, dark mode support. Remove any duplicated or unused components. Every component should match production quality.

### Acceptance Criteria
- [ ] All components in src/components/ui/ have consistent sizing, spacing, and color tokens
- [ ] All interactive components are keyboard-navigable and have proper ARIA attributes
- [ ] Dark mode renders correctly for every component (no broken colors or invisible text)
- [ ] No unused or duplicated component files remain
- [ ] npm run build succeeds
- [ ] npm run lint passes

## REQ-003 – Dashboard & Home Page

**Status:** not passing
**Priority:** 30

### Description
Rewrite the Dashboard/Home page (src/app/page.tsx) with polished UX. Story cards should show title, description, last-edited date, and a thumbnail/preview. Create, delete (with confirmation dialog), rename, and duplicate story actions. Empty state when no stories exist. Responsive grid layout. Smooth transitions.

### Acceptance Criteria
- [ ] Dashboard shows all stories as cards with title, description, and last-edited date
- [ ] Create story opens a dialog with title and description fields, creates story and navigates to it
- [ ] Delete story shows a confirmation dialog before deleting
- [ ] Duplicate story creates a copy with '(Copy)' suffix
- [ ] Empty state shows a clear call-to-action when no stories exist
- [ ] npm run build succeeds and page loads without console errors

## REQ-004 – Tab Navigation & Sidebar

**Status:** not passing
**Priority:** 40

### Description
Rewrite tab navigation and sidebar (SidebarNav, layout.tsx, story layout). Clean Gacha-style bottom tab bar on the main layout. Story-level sidebar navigation between tabs (Notes, Characters, Timeline, World, Scenes, Items). Active tab highlighting, smooth transitions, proper routing. Consistent layout shell that doesn't re-mount 3D canvases on tab switch.

### Acceptance Criteria
- [ ] Bottom tab bar shows on all pages with proper active state highlighting
- [ ] Story sidebar shows all 6 tabs with icons and labels, highlights active tab
- [ ] Switching tabs does not cause full page reloads or loss of in-progress work
- [ ] Home button in tab bar returns to dashboard
- [ ] Navigation is keyboard-accessible (Tab, Enter, arrow keys)
- [ ] npm run build succeeds

## REQ-005 – Shared 3D Rendering Infrastructure

**Status:** not passing
**Priority:** 50

### Description
Create a clean shared 3D rendering infrastructure used by Characters, Scenes, World, and Items tabs. Shared cel-shading material factory, shared lighting setup, shared camera rig component, shared transform gizmo wrapper. Proper loading states (suspense boundaries with spinners), error boundaries for WebGL failures, and dispose/cleanup on unmount to prevent memory leaks.

### Acceptance Criteria
- [ ] A shared CelShadingMaterial factory exists and is used by Characters, Scenes, and Items tabs
- [ ] A shared camera rig component supports orbit and first-person modes with smooth transitions
- [ ] All 3D canvases show a loading spinner while models/textures load (React Suspense)
- [ ] All 3D canvases have an error boundary that shows a user-friendly message on WebGL failure
- [ ] Switching away from a 3D tab properly disposes Three.js resources (no memory leaks)
- [ ] npm run build succeeds

## REQ-006 – Character Data Model

**Status:** not passing
**Priority:** 100

### Description
Rewrite Character data model and store. Clean TypeScript interfaces for Character, CharacterAppearance, CategoryColors, Transform. CRUD operations (create, read, update, delete) with proper validation. Character search/filter. Proper ID generation. All personality fields (backstory, outlook, favorites, custom fields) with no word limits.

### Acceptance Criteria
- [ ] Character type has clean, well-documented interfaces with JSDoc comments
- [ ] Create character generates a unique ID and sensible defaults for appearance
- [ ] Update character supports partial updates without overwriting unrelated fields
- [ ] Delete character shows confirmation and removes all references (from scenes, timeline)
- [ ] All personality fields accept arbitrary-length text with no truncation
- [ ] Custom fields support add/rename/delete of user-defined key-value pairs
- [ ] npm run build succeeds with zero type errors

## REQ-007 – Character 3D Viewer

**Status:** not passing
**Priority:** 110

### Description
Rewrite the 3D character viewer (Viewer3D.tsx). Clean model loading with proper SkeletonUtils.clone(), cel-shading rendering, hair physics (SpringBoneSystem), and color application. Smooth orbit controls. The viewer should load fast, render cleanly, and not leak memory. Proper loading and error states.

### Acceptance Criteria
- [ ] Character model loads and renders with cel-shading within 2 seconds on a mid-range machine
- [ ] Color changes (hair, skin, eyes, clothing) apply instantly without model reload
- [ ] Hair physics (SpringBoneSystem) runs smoothly at 60fps
- [ ] Orbit controls allow smooth rotation, zoom, and pan
- [ ] Switching between characters does not cause memory leaks (check with Chrome DevTools Memory tab)
- [ ] Loading state shows a spinner; broken model shows an error message, not a blank canvas
- [ ] npm run build succeeds

## REQ-008 – Character Tab UI

**Status:** not passing
**Priority:** 120

### Description
Rewrite the Characters tab UI. Left panel: character list with create/delete/rename. Center: 3D viewer. Right panel: tabbed editor for appearance (color pickers, asset toggles, hair undertone) and personality (free-form text fields, custom fields). Polished layout with proper spacing, responsive panels, and smooth interactions.

### Acceptance Criteria
- [ ] Character list shows all characters with names, allows create/delete/rename via context menu or buttons
- [ ] Selecting a character updates the 3D viewer and editor panel
- [ ] Color pickers for hair, skin tone, eye color, and clothing categories work with live 3D preview
- [ ] Hair undertone texture picker works and previews in real-time on the 3D model
- [ ] Personality tab shows all free-form fields (backstory, outlook, favorites) with auto-saving
- [ ] Custom fields section allows adding, renaming, and deleting user-defined fields
- [ ] All panels have proper overflow scrolling and don't break at different window sizes
- [ ] npm run build succeeds

## REQ-009 – Timeline Data Model

**Status:** not passing
**Priority:** 200

### Description
Rewrite Timeline data model and store. Clean TimelineEvent, CharacterState, RelationshipState types. Support for multiple parallel tracks, event ordering, duration, scene linking (bidirectional). Proper CRUD with undo/redo support.

### Acceptance Criteria
- [ ] TimelineEvent, CharacterState, RelationshipState have clean typed interfaces
- [ ] Events support ordering within tracks and reordering via drag
- [ ] Multiple parallel tracks can be created, renamed, and deleted
- [ ] Scene linking is bidirectional — setting linkedSceneId on an event also updates the scene's linkedTimelineEventId
- [ ] Undo/redo works for all timeline mutations (add, delete, reorder, edit)
- [ ] npm run build succeeds with zero type errors

## REQ-010 – Timeline Canvas

**Status:** not passing
**Priority:** 210

### Description
Rewrite TimelineCanvas with polished rendering and interactions. Horizontal tracks with zoomable/pannable timeline. Draggable event blocks with snap-to-grid. Track headers with add/rename/delete. Playhead indicator. Event blocks show title and color. Double-click to edit. Smooth 60fps rendering even with 100+ events.

### Acceptance Criteria
- [ ] Timeline renders horizontal tracks with labeled headers
- [ ] Event blocks are draggable with smooth snapping within their track
- [ ] Events can be moved between tracks via drag-and-drop
- [ ] Zoom in/out changes time scale smoothly (mouse wheel or buttons)
- [ ] Pan works via middle-mouse drag or scroll
- [ ] Double-clicking an event opens its editor
- [ ] Rendering stays at 60fps with 100 events across 5 tracks
- [ ] npm run build succeeds

## REQ-011 – Timeline Event Editor

**Status:** not passing
**Priority:** 220

### Description
Rewrite the timeline event editor panel. Edit event title, description, duration, color, and track. Character states section: add characters, set description/location/emotional state for each. Relationship states section: define relationships between characters at this point. Scene link: select or create a linked scene.

### Acceptance Criteria
- [ ] Event editor opens as a side panel or dialog when an event is selected
- [ ] Title, description, duration, and color fields save on change
- [ ] Character states section lists all characters in the story, each with description/location/emotional state fields
- [ ] Relationship states section lets you define relationships between any two characters with free-form text and strength
- [ ] Scene link dropdown shows existing scenes and has a 'Create New Scene' option
- [ ] All changes persist immediately to the store
- [ ] npm run build succeeds

## REQ-012 – Relationship System

**Status:** not passing
**Priority:** 300

### Description
Rewrite the Relationship System with its own dedicated UI. Relationship chart/graph showing all characters and their connections. Click a connection to edit the relationship (free-form type, description, strength, one-sidedness). Relationships are stored per timeline event so you can see how they change over time. Relationship canvas with visual node-and-edge display.

### Acceptance Criteria
- [ ] A relationship view shows all characters as nodes with edges for defined relationships
- [ ] Clicking an edge opens an editor with: relationship type (free-form), description, strength (1-3), and direction (mutual, A→B only, B→A only)
- [ ] New relationships can be created by selecting two characters
- [ ] Relationships from the current timeline event are shown; switching events updates the display
- [ ] The graph layout is clean and readable with up to 20 characters
- [ ] npm run build succeeds

## REQ-013 – Scene Data Model

**Status:** not passing
**Priority:** 400

### Description
Rewrite Scene data model and store. Clean types for Scene, SceneCharacter, CameraKeyframe, MovementKeyframe, AnimationKeyframe, DialogueLine, SceneProp. Proper keyframe interpolation logic. CRUD with undo/redo. Scene duration auto-calculated from latest keyframe.

### Acceptance Criteria
- [ ] All scene types have clean interfaces with proper documentation
- [ ] Keyframe types support position, rotation, and easing (linear, ease-in, ease-out, ease-in-out)
- [ ] Scene duration is auto-calculated from the latest keyframe or dialogue end time
- [ ] Undo/redo works for all scene operations (add/remove characters, edit keyframes, edit dialogue)
- [ ] Adding a character to a scene creates proper default position and empty keyframe tracks
- [ ] npm run build succeeds with zero type errors

## REQ-014 – Scene 3D Viewer

**Status:** not passing
**Priority:** 410

### Description
Rewrite SceneViewer3D with clean 3D rendering. Character models load with cel-shading. Props render correctly. Free orbit camera in edit mode. Ground plane or world backdrop. Proper lighting. Selection highlighting (outline or glow on selected character/prop). Transform gizmos for positioning.

### Acceptance Criteria
- [ ] Scene renders all placed characters with their correct appearance (colors, visible assets)
- [ ] Props (cube, sphere, cylinder, etc.) render with correct transforms and colors
- [ ] Selected object shows a visible highlight (outline or glow)
- [ ] Transform gizmo appears on selected object allowing translate/rotate/scale
- [ ] World location backdrop loads when a scene is linked to a world location
- [ ] Camera orbit is smooth with no jitter or clipping
- [ ] npm run build succeeds

## REQ-015 – Scene Timeline & Keyframe Editor

**Status:** not passing
**Priority:** 420

### Description
Rewrite the scene timeline/keyframe editor. Track-based UI with: ruler (time scale), playhead (draggable), per-character tracks (movement + animation), camera track, dialogue track. Keyframe diamonds on tracks. Click to select, drag to move, right-click to delete. Zoom and pan.

### Acceptance Criteria
- [ ] Ruler shows time markings that update with zoom level
- [ ] Playhead is draggable and snaps to time increments
- [ ] Each character in the scene has a movement track and animation track
- [ ] Camera track shows camera keyframe diamonds
- [ ] Dialogue track shows dialogue blocks with character name and text preview
- [ ] Keyframes can be selected (click), moved (drag), and deleted (right-click or Delete key)
- [ ] Zoom (mouse wheel) and pan (middle-drag) work smoothly
- [ ] npm run build succeeds

## REQ-016 – Scene Character Controls

**Status:** not passing
**Priority:** 430

### Description
Rewrite scene character controls. CharacterActionPanel for setting position/rotation at keyframes. AnimationPicker for selecting idle, walk, talk, and custom animations. Add/remove characters from scene. Character list panel showing all characters in the scene with visibility toggles.

### Acceptance Criteria
- [ ] Panel shows all characters in the scene with name, thumbnail, and visibility toggle
- [ ] Add character button shows a dropdown of story characters not yet in the scene
- [ ] Remove character button removes character and all their keyframes (with confirmation)
- [ ] Position/rotation fields update the 3D view in real-time
- [ ] Setting position at a specific time creates or updates a movement keyframe
- [ ] AnimationPicker shows available animations with preview thumbnails
- [ ] Selected animation applies to the character in the 3D view
- [ ] npm run build succeeds

## REQ-017 – Scene Camera System

**Status:** not passing
**Priority:** 440

### Description
Rewrite the scene camera keyframe system. CameraActionPanel for setting camera position, target (look-at), and FOV at keyframes. 'Set from current view' button captures the orbit camera state as a keyframe. Preview mode that interpolates between camera keyframes. Smooth camera transitions during playback.

### Acceptance Criteria
- [ ] 'Set from current view' captures current orbit camera position/target/FOV as a keyframe at the playhead time
- [ ] Camera keyframes can be edited (position, target, FOV) via number fields
- [ ] Preview mode smoothly interpolates between camera keyframes when scrubbing the playhead
- [ ] Camera transitions during playback use configurable easing (linear, ease-in-out)
- [ ] Deleting a camera keyframe updates the interpolation correctly
- [ ] npm run build succeeds

## REQ-018 – Scene Dialogue & Subtitles

**Status:** not passing
**Priority:** 450

### Description
Rewrite the dialogue/subtitle system. Dialogue editor: add lines with character, text, start time, duration. Dialogue blocks appear on the timeline dialogue track. SubtitleOverlay renders during playback with character name and styled text. Support for multiple simultaneous lines (overlapping times).

### Acceptance Criteria
- [ ] Add dialogue line opens an inline editor with character selector, text field, start time, and duration
- [ ] Dialogue blocks appear on the dialogue track at the correct time position with correct width
- [ ] SubtitleOverlay renders dialogue at the bottom of the 3D viewport during playback
- [ ] Subtitle shows character name (styled) and dialogue text with fade-in/fade-out
- [ ] Overlapping dialogue lines are stacked vertically in the overlay
- [ ] Editing a dialogue line updates the timeline block and subtitle in real-time
- [ ] npm run build succeeds

## REQ-019 – Scene Playback Mode

**Status:** not passing
**Priority:** 460

### Description
Rewrite scene playback mode. Play/pause button starts playback: camera follows camera keyframes, characters move along movement keyframes, animations play, subtitles appear. Playhead advances in real-time. Stop resets to beginning. Speed controls (0.5x, 1x, 2x). Scrubbing works during pause.

### Acceptance Criteria
- [ ] Play button starts playback — playhead advances in real-time
- [ ] Camera smoothly follows camera keyframes with interpolation
- [ ] Characters move smoothly between movement keyframes
- [ ] Character animations play at the correct keyframe times
- [ ] Subtitles appear and disappear at the correct times
- [ ] Pause freezes all playback at the current time
- [ ] Stop resets playhead to time 0
- [ ] Speed selector offers 0.5x, 1x, and 2x options
- [ ] Dragging the playhead during pause updates the 3D view to that point in time
- [ ] npm run build succeeds

## REQ-020 – World Viewport & Terrain

**Status:** not passing
**Priority:** 500

### Description
Rewrite WorldViewport3D with clean terrain rendering. Vertex-displaced terrain mesh from heightmap data. Orbit camera + first-person camera (Minecraft creative mode: WASD, sprint, Space to fly, Shift to descend). Smooth camera switching. Proper lighting. Ground texture/material rendering. Water plane at sea level. Performant rendering with terrain chunking.

### Acceptance Criteria
- [ ] Terrain mesh renders from heightmap data with smooth vertex displacement
- [ ] Orbit camera allows rotation, zoom, and pan with no jitter
- [ ] First-person camera supports WASD movement, sprint (Shift), fly (Space), descend (Ctrl)
- [ ] Camera mode toggle switches smoothly between orbit and first-person
- [ ] Terrain materials/textures render correctly on the mesh
- [ ] Water plane renders at sea level with basic transparency
- [ ] Terrain chunks load/unload based on camera distance for performance
- [ ] Maintains 30+ fps with a 256x256 heightmap
- [ ] npm run build succeeds

## REQ-021 – Terrain Sculpt & Paint Tools

**Status:** not passing
**Priority:** 510

### Description
Rewrite terrain sculpt and paint tools. Sculpt modes: raise, lower, flatten, smooth. Configurable brush size, strength, and falloff (soft/hard edge). Material paint brush that assigns terrain materials to vertices. Visual brush preview (circle on terrain surface). Undo/redo for all sculpt and paint operations.

### Acceptance Criteria
- [ ] Sculpt raise/lower modifies terrain height under the brush in real-time
- [ ] Sculpt flatten brings terrain to a target height
- [ ] Sculpt smooth averages neighboring vertices for smoother terrain
- [ ] Brush size, strength, and falloff are adjustable via sliders
- [ ] Brush preview circle renders on the terrain surface following the mouse
- [ ] Material paint assigns terrain materials (grass, rock, sand, dirt, etc.) to vertices
- [ ] Painted materials render correctly with proper textures
- [ ] Undo/redo works for all sculpt and paint operations
- [ ] All changes persist to IndexedDB
- [ ] npm run build succeeds

## REQ-022 – Object Placement System

**Status:** not passing
**Priority:** 520

### Description
Rewrite object placement system. Object catalog with categories (buildings, decorations, props, vegetation). Click-to-place on terrain. Select tool with translate/rotate/scale gizmos. Grid snapping and rotation snapping toggles. Multi-select with Shift+click. Delete selected objects. Duplicate selected objects. Undo/redo for placement operations.

### Acceptance Criteria
- [ ] Object catalog panel shows objects organized by category with thumbnail previews
- [ ] Clicking an object in the catalog then clicking on terrain places it at that position
- [ ] Select tool highlights the object under cursor on hover
- [ ] Selected object shows translate/rotate/scale gizmos (mode switchable via buttons or Q/W/E keys)
- [ ] Grid snap toggle snaps position to grid increments
- [ ] Rotation snap toggle snaps to 15-degree increments
- [ ] Shift+click adds/removes objects from selection
- [ ] Delete key removes selected objects (with undo support)
- [ ] Ctrl+D duplicates selected objects
- [ ] All operations have undo/redo
- [ ] npm run build succeeds

## REQ-023 – Hierarchical World System

**Status:** not passing
**Priority:** 530

### Description
Rewrite hierarchical world system (World → Country → City → Building). LevelBreadcrumb for drill-down navigation. Polygon border drawing to define region boundaries. Entering a child region loads its own terrain (initialized from parent). Terrain blending at boundaries. Back button to return to parent level.

### Acceptance Criteria
- [ ] Breadcrumb shows current hierarchy path (e.g., World > Country > City)
- [ ] Clicking a region name in the breadcrumb navigates to that level
- [ ] Create new region: draw polygon boundary on current terrain, name it, drill into it
- [ ] Child region terrain initializes from the parent's heightmap within the boundary
- [ ] Terrain blending smoothly transitions at region edges
- [ ] Back button returns to parent level
- [ ] Regions persist to IndexedDB with parent-child relationships
- [ ] npm run build succeeds

## REQ-024 – Cartography & Terrain Generation

**Status:** not passing
**Priority:** 540

### Description
Rewrite CartographyEditor for 2D biome painting. Top-down 2D view of the world. Paint biomes (ocean, plains, mountains, forest, desert, tundra, etc.) with a brush. Generate 3D terrain from the biome map (oceans are low, mountains are high, etc.). Heightmap import from PNG/JPEG images.

### Acceptance Criteria
- [ ] 2D top-down view renders the world as a grid of biome colors
- [ ] Biome brush paints the selected biome onto the grid
- [ ] Biome palette shows all available biomes with distinct colors
- [ ] Generate terrain button converts biome map to 3D heightmap (ocean=low, mountain=high)
- [ ] Heightmap import accepts PNG/JPEG and converts pixel brightness to terrain height
- [ ] Generated terrain matches the biome map layout
- [ ] npm run build succeeds

## REQ-025 – Roads & Lot System

**Status:** not passing
**Priority:** 550

### Description
Rewrite road and lot system. Road drawing with waypoints — click to place points, roads connect between them. Road types (highway, main, street, alley, footpath) with different widths and materials. Intersections auto-detect where roads cross. Lot drawing: define rectangular or polygonal areas with zoning types (residential, commercial, industrial, park, special).

### Acceptance Criteria
- [ ] Click-to-place road waypoints creates road segments between consecutive points
- [ ] Road type selector changes road width and visual material
- [ ] Intersections are auto-detected and rendered where roads cross
- [ ] Roads render as 3D surfaces on the terrain
- [ ] Lot tool allows drawing rectangular areas on terrain
- [ ] Lots have configurable zoning type with distinct color overlays
- [ ] Roads and lots persist to IndexedDB
- [ ] npm run build succeeds

## REQ-026 – Building Interior System

**Status:** not passing
**Priority:** 560

### Description
Rewrite building interior system. Entering a building transitions to an interior 3D space. Wall placement with material options (drywall, brick, stone, glass, wood, concrete). Door and window openings on walls. Floor painting with materials (wood, tile, carpet, marble, concrete, stone). Furniture placement from a catalog with categories. Room detection from wall layout. Multi-floor support with floor switcher.

### Acceptance Criteria
- [ ] Double-clicking a building in the world transitions to its interior 3D space
- [ ] Wall tool places wall segments between click points
- [ ] Walls have configurable material/texture
- [ ] Door and window openings can be placed on existing walls
- [ ] Floor paint tool applies floor materials to areas enclosed by walls
- [ ] Furniture catalog shows items by category (seating, tables, storage, lighting, etc.)
- [ ] Placing furniture snaps to floor and aligns to walls when near them
- [ ] Room detection identifies enclosed areas and labels them
- [ ] Floor switcher allows navigating between floors in multi-story buildings
- [ ] Exiting interior returns to the world view
- [ ] npm run build succeeds

## REQ-027 – World Builder UI Panels

**Status:** not passing
**Priority:** 570

### Description
Rewrite world builder UI panels. Roblox Studio-style ribbon tab bar (Home, Terrain, Build, Environment, View). Dockable resizable panels (DockPanel, DockColumn, DockResizeHandle). ExplorerTree showing all placed objects in a collapsible tree with folders, click-to-select, shift-multi-select, double-click-to-enter-region, and delete buttons. Properties panel showing selected object properties (Name, Position, Rotation, Scale, Color, Lock, Visibility, Duplicate, Delete).

### Acceptance Criteria
- [ ] Ribbon tab bar shows Home/Terrain/Build/Environment/View tabs with relevant tools in each
- [ ] Panels are dockable and resizable with drag handles
- [ ] ExplorerTree shows all objects in a collapsible folder hierarchy
- [ ] Click selects an object in the tree and highlights it in the 3D view
- [ ] Shift+click multi-selects objects in the tree
- [ ] Double-click on a region drills into it
- [ ] Properties panel shows and allows editing of: Name, Position, Rotation, Scale, Color
- [ ] Lock, Visibility, Duplicate, and Delete buttons work on selected objects
- [ ] Panel state (which panels are open, sizes) persists across sessions
- [ ] npm run build succeeds

## REQ-028 – MiniMap & Weather System

**Status:** not passing
**Priority:** 580

### Description
Rewrite MiniMap and weather system. MiniMap renders a real-time top-down overview of the terrain with a camera frustum indicator. Click minimap to teleport camera. Weather system UI with presets (clear, rain, snow, fog) that visually affect the 3D viewport. Playtesting mode (play/stop) for walking through the world in first-person.

### Acceptance Criteria
- [ ] MiniMap renders in a corner showing a top-down view of the terrain
- [ ] Camera position is shown as a frustum indicator on the minimap
- [ ] Clicking the minimap teleports the camera to that position
- [ ] Weather selector offers clear, rain, snow, and fog presets
- [ ] Selecting a weather type visually changes the 3D viewport (fog density, particle effects, lighting)
- [ ] Play button enters playtesting mode (first-person walk-through, no editing tools)
- [ ] Stop button exits playtesting mode and returns to edit mode
- [ ] npm run build succeeds

## REQ-029 – Items Editor

**Status:** not passing
**Priority:** 600

### Description
Rewrite the Items tab. 3D object editor for creating custom story assets from primitives. Item list panel with create/delete/rename. 3D viewport with transform gizmos. Combine primitives (cube, sphere, cylinder, cone, etc.) into composite objects. Color/material per primitive. Item history (undo/redo). Serialization for saving and loading items. Items can be used as scene props.

### Acceptance Criteria
- [ ] Item list shows all items with names and thumbnails
- [ ] Create item starts with a single cube primitive in the 3D editor
- [ ] Add primitive button adds cubes, spheres, cylinders, cones to the item
- [ ] Each primitive can be selected and transformed (position, rotation, scale) via gizmos
- [ ] Each primitive has configurable color/material
- [ ] Undo/redo works for all item editing operations
- [ ] Items serialize to JSON and deserialize correctly with no data loss
- [ ] Items appear in the scene editor's prop catalog for placement in scenes
- [ ] npm run build succeeds

## REQ-030 – Master Document System

**Status:** not passing
**Priority:** 610

### Description
Rewrite the Master Document System. Upload .md, .txt, and .docx files. Parse and display content. Multiple master docs per story. Document list with upload/delete. Full-text view of each document. Search within documents. Documents are stored in the Zustand store and persist to localStorage.

### Acceptance Criteria
- [ ] Upload button accepts .md, .txt, and .docx files
- [ ] .docx files are parsed correctly using mammoth (preserving headings, paragraphs, lists)
- [ ] Document list shows filename, upload date, and word count
- [ ] Clicking a document opens a full-text read view
- [ ] Delete button removes a document (with confirmation)
- [ ] Search bar filters/highlights text within the currently viewed document
- [ ] All documents persist across page reloads
- [ ] npm run build succeeds

## REQ-031 – Backup & Restore

**Status:** not passing
**Priority:** 700

### Description
Implement backup/restore via JSON export/import. Download Backup button exports ALL app data (stories, characters, timelines, scenes, worlds, items, master docs) as a single JSON file. Restore from Backup button imports a JSON file and replaces current data (with confirmation warning). Support for partial imports (e.g., import just one story from a backup).

### Acceptance Criteria
- [ ] Download Backup exports a JSON file containing all app data
- [ ] The exported file includes a version number for future migration
- [ ] Restore from Backup accepts a JSON file and shows a preview of what will be imported
- [ ] Full restore replaces all data after user confirms a destructive warning
- [ ] Partial import allows selecting individual stories to import without affecting other data
- [ ] Imported data is immediately usable (no page reload required)
- [ ] Round-trip test: export → delete all data → import → all data restored identically
- [ ] npm run build succeeds

## REQ-032 – Performance Optimization

**Status:** not passing
**Priority:** 710

### Description
Performance optimization pass across the entire app. 3D scenes: proper disposal, instancing for repeated objects, LOD for distant objects, frustum culling. Large data: virtualized lists for character/event/scene lists. State: memoize selectors, avoid unnecessary re-renders. Measure and fix the worst bottlenecks.

### Acceptance Criteria
- [ ] World builder maintains 30+ fps with 500 placed objects
- [ ] Character list scrolls smoothly with 50+ characters (virtualized rendering)
- [ ] Timeline renders smoothly with 100+ events across 10 tracks
- [ ] Switching between tabs takes less than 500ms
- [ ] No Three.js memory leaks when switching between 3D tabs (verified via Chrome DevTools)
- [ ] npm run build succeeds with no 'size limit exceeded' warnings on any page

## REQ-033 – UI Consistency Pass

**Status:** not passing
**Priority:** 720

### Description
Final UI consistency pass across all tabs. Ensure consistent spacing, font sizes, button styles, panel layouts, color usage, icon styles, and interaction patterns across Dashboard, Characters, Timeline, World, Scenes, and Items tabs. Fix any misaligned elements, inconsistent padding, or broken dark mode areas.

### Acceptance Criteria
- [ ] All tabs use the same button sizes, font hierarchy, and spacing scale
- [ ] All panels use consistent header styles and padding
- [ ] All color usage follows the blue theme consistently
- [ ] Dark mode works correctly on every tab with no broken colors or invisible text
- [ ] All icons are from Lucide React with consistent sizing
- [ ] No visual regressions — manually inspect every tab in both light and dark mode
- [ ] npm run build succeeds and npm run lint passes

## REQ-034 – Life Mode Time System

**Status:** not passing
**Priority:** 900

### Description
Implement Life Mode time system. Time passes Sims-style: 1 real minute = 1 in-game hour (default). Speed controls: Pause, 1x, 2x, 4x, 8x, ultra-fast. In-game clock display. Day/night cycle that affects 3D lighting. Characters follow daily schedules based on time.

### Acceptance Criteria
- [ ] Time control bar shows current in-game time (hour:minute, day, date)
- [ ] Speed buttons switch between Pause, 1x, 2x, 4x, 8x speeds
- [ ] At 1x speed, 1 real minute advances 1 in-game hour
- [ ] Day/night cycle changes 3D viewport lighting (bright midday, dark night, dawn/dusk transitions)
- [ ] Pausing freezes all simulation
- [ ] Ultra-fast mode skips rendering and advances time quickly (for 'what happened overnight')
- [ ] npm run build succeeds

## REQ-035 – Life Mode Activities

**Status:** not passing
**Priority:** 910

### Description
Implement Life Mode simulated activities. Characters perform daily routines (eating, sleeping, working, hygiene, commuting). Social interactions happen between characters sharing a location (conversations, gatherings, conflicts). Characters pursue personal goals and hobbies. Random events occur (accidents, discoveries, surprises).

### Acceptance Criteria
- [ ] Characters have a daily schedule (wake, eat, work, socialize, sleep) that they follow autonomously
- [ ] Characters move between locations on the world map according to their schedule
- [ ] When two characters are in the same location, social interactions can trigger
- [ ] Social interactions generate dialogue and update relationship scores
- [ ] Random events trigger at configurable probability and create notable moments
- [ ] All activities are logged to a history that the user can review
- [ ] npm run build succeeds

## REQ-036 – Life Mode Secrets & Knowledge

**Status:** not passing
**Priority:** 920

### Description
Implement secret and knowledge tracking for Life Mode. Per-character knowledge base: facts (with confidence), beliefs (may be false), secrets known, secrets kept. Secret revelation mechanics (overheard, evidence, confessions, slips). Lies tracked with content, truth, targets, motivation, risks, and exposure status. Dramatic irony toggle (viewer sees all secrets).

### Acceptance Criteria
- [ ] Each character has a knowledge panel showing facts, beliefs, and secrets
- [ ] Secrets have a visibility status: hidden, suspected, or exposed
- [ ] Lies track the liar, targets, content, truth, and current status
- [ ] Secrets can be revealed through interaction events (configurable revelation mechanics)
- [ ] Dramatic irony toggle lets the viewer see all character secrets and thoughts
- [ ] Knowledge changes are logged to the activity history
- [ ] npm run build succeeds

## REQ-037 – Voice System (TTS)

**Status:** not passing
**Priority:** 930

### Description
Implement text-to-speech voice system. Simple TTS (Web Speech API or similar) for dialogue playback. Multiple voice presets for different character types. Adjustable pitch and speed per character. Voice plays during scene playback when dialogue lines are active.

### Acceptance Criteria
- [ ] Each character has a voice settings panel with preset selection, pitch slider, and speed slider
- [ ] During scene playback, dialogue lines are spoken aloud via TTS
- [ ] Different characters sound distinct based on their voice settings
- [ ] Voice can be toggled on/off globally and per-character
- [ ] TTS works in Chrome and Firefox (Web Speech API or fallback)
- [ ] npm run build succeeds

## REQ-038 – Scene Audio (Music & SFX)

**Status:** not passing
**Priority:** 940

### Description
Implement scene audio system. Background music: upload or select audio tracks per scene, loop during playback. Sound effects: attach sound cues to keyframe times. Volume controls for music and SFX separately. Audio plays during scene playback and stops when stopped.

### Acceptance Criteria
- [ ] Scene editor has a music section to upload or select a background audio track
- [ ] Background music loops during scene playback
- [ ] Sound effects can be placed on the timeline at specific times
- [ ] Volume sliders for music and SFX are separate and adjustable
- [ ] Audio stops immediately when playback is stopped
- [ ] Audio files persist (stored as base64 or in IndexedDB)
- [ ] npm run build succeeds

## REQ-039 – Monetization Framework

**Status:** not passing
**Priority:** 950

### Description
Implement monetization framework. Decide and implement one of: one-time purchase, subscription, or token-pack model. Usage metering for AI features (track tokens/hours consumed). Payment integration (Stripe or similar). Local LLM option that bypasses metering. Settings page showing usage and billing.

### Acceptance Criteria
- [ ] Settings page shows current plan/tier and usage statistics
- [ ] AI features check usage quota before executing
- [ ] Payment flow works end-to-end (test mode) for purchasing the selected model
- [ ] Local LLM toggle in settings bypasses all usage metering
- [ ] Graceful handling when quota is exceeded (informative message, not a crash)
- [ ] npm run build succeeds

## REQ-040 – Cloud Database (Supabase)

**Status:** not passing
**Priority:** 960

### Description
Replace localStorage with Supabase cloud database. User data syncs across devices. Offline support with local cache that syncs when online. Migration from localStorage to Supabase for existing users.

### Acceptance Criteria
- [ ] All story data persists to Supabase instead of localStorage
- [ ] Data syncs across devices when logged in
- [ ] App works offline using cached data and syncs when connection is restored
- [ ] Existing localStorage data is migrated to Supabase on first login
- [ ] npm run build succeeds

## REQ-041 – User Authentication

**Status:** not passing
**Priority:** 970

### Description
Implement user authentication via Supabase Auth. Sign up, log in, log out, password reset. OAuth providers (Google, GitHub). Protected routes — unauthenticated users are redirected to login. User profile page with email and display name.

### Acceptance Criteria
- [ ] Sign up form with email/password creates an account
- [ ] Log in form authenticates and redirects to dashboard
- [ ] OAuth buttons for Google and GitHub work
- [ ] Log out clears session and redirects to login
- [ ] Password reset sends an email and allows setting a new password
- [ ] Unauthenticated access to /story/* routes redirects to login
- [ ] npm run build succeeds

## REQ-042 – Mobile PWA

**Status:** not passing
**Priority:** 980

### Description
Add Progressive Web App (PWA) support and mobile responsiveness. Service worker for offline caching. 'Add to Home Screen' manifest. Responsive layouts for all tabs on tablet and phone screen sizes. Touch-friendly controls for 3D viewports.

### Acceptance Criteria
- [ ] PWA manifest is configured with app name, icons, and theme color
- [ ] Service worker caches static assets for offline loading
- [ ] 'Add to Home Screen' prompt appears on mobile browsers
- [ ] All tabs render correctly on tablet (768px) and phone (375px) widths
- [ ] 3D viewports support touch gestures (pinch-to-zoom, drag-to-rotate)
- [ ] npm run build succeeds

## REQ-043 – Shared Story & Character Uploads

**Status:** not passing
**Priority:** 990

### Description
Implement shared story/character uploads. Users can publish stories or individual characters to a shared gallery. Browse and download other users' stories/characters (like Sims families). Import downloaded content into your own projects. Content moderation basics (report button).

### Acceptance Criteria
- [ ] Publish button uploads a story or character to the shared gallery
- [ ] Gallery page shows published content with title, author, thumbnail, and download count
- [ ] Download button imports content into the user's local data
- [ ] Downloaded characters can be placed in any of the user's stories
- [ ] Report button flags content for review
- [ ] npm run build succeeds

## REQ-044 – Character Poses & Animations

**Status:** not passing
**Priority:** 995

### Description
Implement character poses and animations. New 3D character model with proper rigging for poses. Pose library with presets (standing, sitting, walking, running, waving, etc.). Custom pose editor. Animations play during scene playback based on animation keyframes.

### Acceptance Criteria
- [ ] Character model supports at least 10 preset poses
- [ ] Pose can be set per character per scene keyframe
- [ ] Custom pose editor allows adjusting individual bones
- [ ] Walking/running animations play smoothly during scene movement keyframes
- [ ] Animations blend smoothly between keyframes (no popping)
- [ ] npm run build succeeds

## REQ-045 – Custom Story Templates

**Status:** not passing
**Priority:** 996

### Description
Implement custom templates for different use cases. Template presets: D&D Campaign, Visual Novel, Slice of Life, Fantasy Epic. Templates pre-configure character fields, timeline labels, and world settings appropriate to the genre. Users can create and save their own templates.

### Acceptance Criteria
- [ ] New Story dialog offers template selection with at least 4 presets
- [ ] Each template pre-fills character field prompts, timeline track names, and world presets
- [ ] Users can save their current story configuration as a reusable template
- [ ] Custom templates appear alongside built-in templates in the New Story dialog
- [ ] npm run build succeeds

## REQ-046 – Real-Time Collaboration

**Status:** not passing
**Priority:** 997

### Description
Implement real-time collaboration on the canvas/notes system. Multiple users can edit the same canvas simultaneously. Cursor presence (see other users' cursors). Conflict resolution for simultaneous edits. Invite link to share a story for collaboration.

### Acceptance Criteria
- [ ] Invite link generates a shareable URL for a story
- [ ] Multiple users see the same canvas state in real-time
- [ ] Each collaborator's cursor is visible with their name
- [ ] Simultaneous edits to different nodes work without conflict
- [ ] Simultaneous edits to the same node resolve gracefully (last-write-wins or CRDT)
- [ ] npm run build succeeds

## REQ-047 – Advanced Interior Decoration

**Status:** not passing
**Priority:** 998

### Description
Advanced interior decoration system. Expanded furniture catalog with hundreds of items. Wallpaper/paint per wall segment. Ceiling lights and lamps with actual light sources. Rug/carpet placement as decals. Picture frames with uploadable images. Stacking and alignment snapping for precise decoration.

### Acceptance Criteria
- [ ] Furniture catalog has 50+ items across multiple categories
- [ ] Wallpaper/paint can be applied per wall segment independently
- [ ] Lights placed in interiors cast actual light in the 3D view
- [ ] Rugs can be placed on floors as decal-like surfaces
- [ ] Picture frames accept uploaded images
- [ ] Objects snap to alignment guides when dragged near other objects or walls
- [ ] npm run build succeeds

## REQ-048 – Cinematic Camera AI

**Status:** not passing
**Priority:** 999

### Description
Implement cinematic camera AI for scenes. AI suggests camera angles and movements based on the scene content (close-up during dialogue, wide shot for action, over-the-shoulder for conversations). Rule of thirds composition guides. Dolly, truck, crane, and orbit camera movement presets. Depth of field (bokeh) for focus effects.

### Acceptance Criteria
- [ ] Camera preset buttons offer: close-up, medium shot, wide shot, over-the-shoulder, bird's eye
- [ ] Each preset auto-positions the camera relative to the active/selected character
- [ ] Camera movement presets: dolly (forward/back), truck (left/right), crane (up/down), orbit
- [ ] Rule of thirds grid overlay toggle for composition guidance
- [ ] Depth of field slider blurs background/foreground for focus effect
- [ ] Auto-camera mode suggests camera keyframes based on dialogue and movement keyframes
- [ ] npm run build succeeds

## REQ-049 – Multiple Save Files

**Status:** not passing
**Priority:** 1000

### Description
Implement multiple save file support. Users can create named save slots. Save current state to a slot. Load from any slot. Auto-save to a dedicated slot periodically. Save file management (rename, delete, duplicate saves).

### Acceptance Criteria
- [ ] Save menu shows all save slots with name, date, and story count
- [ ] Save button writes current state to the selected slot
- [ ] Load button restores state from a slot (with confirmation if unsaved changes exist)
- [ ] Auto-save runs every 5 minutes to an 'Auto-Save' slot
- [ ] Save slots can be renamed, deleted, and duplicated
- [ ] At least 10 save slots are supported
- [ ] npm run build succeeds

## REQ-050 – Border Drawing Visual Feedback

**Status:** not passing
**Priority:** 30

### Description
When drawing country/city/building borders in the world builder, the user must see real-time visual feedback of the line segments as they place each point. Currently, clicking to place border points shows nothing — the user is drawing blind. Render a visible polyline connecting all placed points, with a dashed preview segment from the last point to the cursor.

### Acceptance Criteria
- [ ] A solid line connects all placed border points as the user clicks
- [ ] A dashed/translucent preview line extends from the last placed point to the current cursor position
- [ ] The preview line updates in real-time as the mouse moves
- [ ] Closing the border (clicking near the first point) shows a filled translucent polygon preview
- [ ] The line is visible against all terrain types (use outline or contrasting color)
- [ ] npm run build succeeds

## REQ-051 – Border Shape Accuracy

**Status:** not passing
**Priority:** 30

### Description
When a user draws a border (country, city, or building), the actual stored and rendered shape must match exactly what was drawn. Currently, borders are forced into axis-aligned bounding boxes — drawing a triangle results in a rectangle. The system must store the actual polygon vertices and render/clip to that polygon at all hierarchy levels.

### Acceptance Criteria
- [ ] Drawing a triangle border results in a triangular region, not a rectangle
- [ ] Drawing any arbitrary polygon preserves the exact shape drawn
- [ ] The border shape is stored as an array of polygon vertices, not a bounding box
- [ ] When entering a region, the terrain is clipped/bounded to the actual polygon shape
- [ ] The Explorer tree and minimap reflect the true polygon shape
- [ ] npm run build succeeds

## REQ-052 – Remove Non-Functional "Add Country" Buttons

**Status:** not passing
**Priority:** 10

### Description
There are "Add Country" buttons in both the Explorer panel and the Regions area that do nothing when clicked. Remove them entirely. Countries are created by drawing borders with the border tool — there is no reason for a standalone "Add Country" button.

### Acceptance Criteria
- [ ] No "Add Country" button exists in the Explorer panel
- [ ] No "Add Country" button exists in the Regions section
- [ ] Countries are created exclusively through the border drawing tool
- [ ] npm run build succeeds

## REQ-053 – Build Tab Ribbon Completeness

**Status:** not passing
**Priority:** 30

### Description
The Build tab in the ribbon is nearly empty — it only shows Select, Delete, and the border tool. All object placement, building, lot, road, wall, door, floor, and furniture tools must be visible and accessible in the Build tab, organized into proper Roblox Studio-style ribbon groups. The tools shown should be context-aware based on the current hierarchy level (world shows different tools than building interior).

### Acceptance Criteria
- [ ] Build tab shows all available tools organized in ribbon groups: Select, Objects, Regions, City, Building
- [ ] Objects group includes Place Object button and object category selector
- [ ] Regions group includes Border and Define Region tools
- [ ] City group includes Lot and Road tools (visible at city level and above)
- [ ] Building group includes Wall, Door, Floor, and Furniture tools (visible at building level)
- [ ] Tools are context-filtered based on current hierarchy level
- [ ] Each group has a labeled bottom divider matching Roblox Studio ribbon style
- [ ] npm run build succeeds

## REQ-054 – Multi-Select and Bulk Object Operations

**Status:** not passing
**Priority:** 40

### Description
Currently, users must individually click each object to select it, making it extremely tedious to delete or manipulate multiple objects. Implement multi-select via shift-click (add to selection), ctrl-click (toggle selection), and box/marquee select (drag to select multiple objects in a region). Selected objects can then be deleted, moved, or duplicated as a group.

### Acceptance Criteria
- [ ] Shift-click adds objects to the current selection without deselecting others
- [ ] Ctrl-click toggles an individual object in/out of the selection
- [ ] Dragging in select mode creates a marquee rectangle that selects all objects within it
- [ ] All selected objects are highlighted with a visible selection indicator
- [ ] Delete key removes all selected objects at once
- [ ] Transform tools (move, scale, rotate) operate on all selected objects as a group
- [ ] Duplicate operation works on multi-selection
- [ ] Selection count is displayed in the Properties panel or status bar
- [ ] npm run build succeeds

## REQ-055 – Objects Dropdown Visibility

**Status:** not passing
**Priority:** 20

### Description
The objects dropdown in the toolbox/Build tab is truncated — users cannot see all available objects in the list. The dropdown must be scrollable and sized to show a reasonable number of items, or use a grid/gallery layout to display all object categories and items visually.

### Acceptance Criteria
- [ ] All available objects are visible (scrollable list or paginated grid)
- [ ] Object categories are clearly labeled and expandable/collapsible
- [ ] Each object shows a name and small thumbnail/icon
- [ ] The dropdown/panel does not overflow the screen — it is constrained with a scrollbar
- [ ] Search/filter functionality to find objects by name
- [ ] npm run build succeeds

## REQ-056 – Hierarchy Navigation Performance

**Status:** not passing
**Priority:** 10

### Description
Navigating between hierarchy levels (World → Country → City → Building and back) takes 20+ seconds, sometimes fails to load at all, and occasionally resets terrain to a flat plane. This is the single biggest usability blocker. Navigation must be near-instant (under 2 seconds). The terrain state must never be lost or reset during navigation.

### Acceptance Criteria
- [ ] Entering a country from world level completes in under 2 seconds
- [ ] Returning to world level from a country completes in under 2 seconds
- [ ] Terrain is never reset to a flat plane during or after navigation
- [ ] The correct region is always entered (no wrong-country bugs)
- [ ] Camera starts at a reasonable zoom level when entering a region (not super zoomed in)
- [ ] The Explorer tree and viewport stay synchronized — both update together
- [ ] Loading state is shown during any brief transition (spinner or progress indicator)
- [ ] npm run build succeeds

## REQ-057 – Terrain Propagation Between Hierarchy Levels

**Status:** not passing
**Priority:** 10

### Description
Terrain modifications made at the world level do not propagate into country-level views. If a user raises a mound on the world map inside a country's boundaries, that mound must be visible when they enter the country. This is a critical data integrity issue. Terrain data must be shared/synchronized across all hierarchy levels with proper coordinate mapping.

### Acceptance Criteria
- [ ] A terrain mound raised at the world level is visible when entering the country that contains it
- [ ] A terrain mound raised at the country level is visible when returning to the world level
- [ ] Terrain edits at any level propagate bidirectionally (up and down the hierarchy)
- [ ] Coordinate mapping between world-space and region-space is correct
- [ ] Material painting also propagates between levels
- [ ] No terrain data is lost during hierarchy navigation
- [ ] npm run build succeeds

## REQ-058 – Unified Environment & Lighting System

**Status:** not passing
**Priority:** 30

### Description
The environment controls are broken and confusing. Day/night only darkens land (not sky or water). Rain and snow only render when zoomed out. Fog has two separate controls — one does nothing. Cloudy weather shows no clouds. Sky color is disconnected from the day/night cycle. Unify all environment controls into one coherent system where lighting presets affect the entire scene (land, sky, water, fog, ambient light) and weather effects render at all zoom levels.

### Acceptance Criteria
- [ ] Day/night presets change sky color, water color, ambient light, and land lighting together
- [ ] Sky color automatically matches the selected lighting preset (not a separate manual control)
- [ ] There is ONE fog control (remove the duplicate that does nothing)
- [ ] Fog affects visibility/distance when enabled, with adjustable density
- [ ] Rain particles render at all camera zoom levels, not just when zoomed out
- [ ] Snow particles render at all camera zoom levels
- [ ] Cloudy preset shows visible cloud cover or haze effect
- [ ] All weather effects can be combined (e.g., rain + fog + dark)
- [ ] Environment panel is organized as one unified section, not scattered across multiple areas
- [ ] npm run build succeeds

## REQ-059 – Explorer Terrain Entry & Properties Integration

**Status:** not passing
**Priority:** 30

### Description
The Explorer tree needs a "Terrain" entry. When the user clicks Terrain in the Explorer, the Properties panel should show terrain-related tools and settings (sculpt brush, paint brush, material picker, terrain statistics). This matches Roblox Studio's paradigm where clicking an item in the Explorer populates the Properties panel with that item's properties and tools. Clicking any object in the Explorer should similarly show that object's properties.

### Acceptance Criteria
- [ ] "Terrain" appears as a permanent entry in the Explorer tree (alongside objects and regions)
- [ ] Clicking "Terrain" in Explorer shows terrain tools in the Properties panel: sculpt brush settings, paint brush settings, material palette, terrain dimensions
- [ ] Clicking any placed object in Explorer shows that object's properties in the Properties panel (position, rotation, scale, type, name)
- [ ] Clicking a region/country in Explorer shows its properties (name, boundary area, child count)
- [ ] The currently selected Explorer item is visually highlighted
- [ ] Selection in Explorer and selection in the 3D viewport are synchronized
- [ ] npm run build succeeds

## REQ-060 – Item/Project Library System

**Status:** not passing
**Priority:** 50

### Description
Implement a library system where users can create standalone items (a house, a park, a custom building) as their own self-contained projects/elements, then place those items into other projects at different hierarchy levels. This is like Alight Motion's projects-and-elements system — an element can go into a project, and a project can go into a project. A user builds a house as a standalone element, then places instances of that house into a city. The library is accessible from any hierarchy level and any project.

### Acceptance Criteria
- [ ] A "Library" panel/tab exists in the world builder showing all saved items/elements
- [ ] Users can save any selection of objects (or an entire region) as a library item with a name and optional thumbnail
- [ ] Library items can be placed into any hierarchy level (world, country, city, building)
- [ ] Placing a library item creates an instance that can be independently positioned, rotated, and scaled
- [ ] Library items can contain other library items (hierarchical composition)
- [ ] Library items are stored independently from any specific project — they persist across all stories/worlds
- [ ] Users can edit a library item's source, and choose whether to update all instances or detach
- [ ] Library items are browsable by category with search/filter
- [ ] npm run build succeeds
