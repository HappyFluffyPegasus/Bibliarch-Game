# Bibliarch MVP - Implementation Phases

## Overview

**Approach**: Sequential - complete each tab fully before moving to the next
**Priority**: All tabs equally important, but built in specific order

---

## Phase 1: Project Setup & Core Structure ✅ COMPLETED

### Tasks
1. ✅ Create `Bibliarch MVP/` folder with Next.js 15 project
2. ✅ Configure Tailwind CSS, TypeScript
3. ✅ Set up folder structure
4. ✅ Create root layout with bottom tab navigation (Gacha-style)
5. ✅ Create Dashboard/Home page (story selection)
6. ✅ Set up Zustand stores (basic structure)
7. ✅ Create placeholder pages for all 5 tabs

### Deliverables
- Working Next.js app with routing
- Dashboard with create/delete story functionality
- Tab navigation between all 5 tabs
- localStorage persistence via Zustand
- Type definitions for all data models

---

## Phase 2: Notes Tab (Copy Bibliarch Canvas) ✅ COMPLETED

### Goal
Integrate the full Bibliarch canvas system from the storycanvas project.

### Completed
- ✅ HTMLCanvas.tsx ported with all dependencies
- ✅ UI components (button, card, dialog, popover, select, slider, tabs, etc.)
- ✅ Providers (color-provider, theme-provider)
- ✅ Utilities (color-palette, templates, performance-utils)
- ✅ All import paths updated
- ✅ Notes tab page renders canvas
- ✅ localStorage persistence for canvas data

---

## Phase 3: Characters Tab (Copy Character Creator) ✅ COMPLETED

### Goal
Integrate the 3D character creator from the Character Creator project.

### Completed
- ✅ Viewer3D.tsx with full 3D character rendering
- ✅ ColorWheel for hair/skin color customization
- ✅ TransformControls for position/rotation/scale editing
- ✅ ItemThumbnail for character item display
- ✅ thumbnailGenerator utility
- ✅ Character list management (create, delete, rename)
- ✅ Data persists to localStorage
- ✅ Hair undertone system with texture picker
- ✅ Cel-shading rendering (toon material)
- ✅ SpringBoneSystem for hair physics
- ✅ SkeletonUtils.clone() for skinned mesh handling

---

## Phase 4: Timeline Tab ✅ COMPLETED

### Goal
Create a dedicated timeline editor separate from the canvas.

### Completed
- ✅ TimelineCanvas — main rendering surface
- ✅ TimelineTrack — horizontal tracks with events
- ✅ TimelineEventBlock — individual event blocks
- ✅ Draggable timeline events
- ✅ Multiple parallel tracks
- ✅ Scene linking
- ✅ Data persists to localStorage

---

## Phase 5: World Tab (3D World Builder) ✅ COMPLETED — MAJOR FEATURE

### Goal
Create a 3D world/neighborhood builder with terraforming, building placement, and hierarchical regions.

### Completed — Core
- ✅ WorldViewport3D — full 3D terrain rendering with Three.js
- ✅ Sculpt brush (raise, lower, flatten, smooth) with configurable size/strength/falloff
- ✅ Material paint system with terrain material catalog
- ✅ Object placement and selection (buildings, decorations, props, vegetation)
- ✅ Select tool with transform gizmos (translate, rotate, scale)
- ✅ MiniMap with real-time overview
- ✅ Orbit camera + First-person camera (Minecraft creative mode: WASD, sprint, fly/walk toggle)
- ✅ Grid snapping and rotation snapping
- ✅ Undo/redo system for sculpt, paint, objects, borders, walls
- ✅ IndexedDB persistence with save/load

### Completed — Hierarchical World System
- ✅ World → Country → City → Building drill-down hierarchy
- ✅ LevelBreadcrumb navigation
- ✅ Polygon border drawing to define regions
- ✅ Child terrain initialization from parent
- ✅ Terrain blending between parent and child nodes

### Completed — Cartography
- ✅ CartographyEditor — 2D biome painting (ocean, plains, mountains, forest, desert, etc.)
- ✅ CartographyPanel — biome brush controls
- ✅ Generate 3D terrain from cartography map
- ✅ Heightmap import from PNG/JPEG

### Completed — City Systems
- ✅ Lot drawing with zoning types (residential, commercial, industrial, park, special)
- ✅ Road drawing with waypoints and road types (highway, main, street, alley, footpath)
- ✅ Road intersections auto-detection

### Completed — Building Interior
- ✅ Wall placement with materials (drywall, brick, stone, glass, wood, concrete)
- ✅ Door/window openings on walls
- ✅ Floor painting with materials (wood, tile, carpet, marble, concrete, stone)
- ✅ Furniture placement from catalog with categories
- ✅ Room detection from wall layout
- ✅ Multi-floor support

### Completed — Rendering
- ✅ GrassSystem with custom shaders
- ✅ Water rendering with sea level
- ✅ Wireframe toggle
- ✅ Terrain chunking for performance (ChunkManager)
- ✅ Custom object catalog with mesh factories

### Completed — UI/UX (February 2025)
- ✅ Roblox Studio-style ribbon tab bar (Home, Terrain, Build, Environment, View)
- ✅ Dockable panels with resize handles (DockPanel, DockColumn, DockResizeHandle)
- ✅ **ExplorerTree** — Roblox-style collapsible scene tree showing all placed objects in folders (Regions, Borders, Objects with category sub-folders), with click-to-select, shift-multi-select, double-click-to-enter-region, and delete buttons
- ✅ **Properties panel restructured** — selected object properties (Name, Position, Rotation, Scale, Color, Lock, Visibility, Duplicate, Delete) always visible at top regardless of active tool; tool-specific settings below; camera settings merged in
- ✅ Camera panel merged into Properties (walk/fly toggle + speed slider shown in first-person mode)
- ✅ Explorer always visible (no auto-hide at building level)
- ✅ Playtesting mode (play/stop)
- ✅ Weather system UI (clear, rain, snow, fog)

---

## Phase 6: Story/Scene Tab (3D) ✅ COMPLETED — MAJOR FEATURE

### Goal
Create a scene editor where characters can be placed in 3D space and scenes can play back.

### Completed
- ✅ SceneViewer3D — 3D scene rendering with character models
- ✅ Character placement in 3D space with transform gizmos
- ✅ CharacterActionPanel — character positioning and animation controls
- ✅ AnimationPicker — animation selection UI
- ✅ AnimationManager — animation loading and playback
- ✅ CameraActionPanel — camera keyframing and control
- ✅ KeyframePropertiesPanel — animation keyframe editing
- ✅ SubtitleOverlay — dialogue subtitle display
- ✅ Track-based scene timeline (Ruler, Playhead, Tracks)
- ✅ SceneCharacterManager for character lifecycle in scenes
- ✅ World locations as scene backdrops (linked from World tab)
- ✅ Scene playback mode

---

## Phase 6.5: Items Tab ✅ COMPLETED

### Goal
Object/item editor for story assets.

### Completed
- ✅ ItemEditor3D — 3D object editor
- ✅ Item selection and transform hooks (useItemSelection, useItemTransform, useItemHistory)
- ✅ Item codec for serialization (itemCodec)
- ✅ Item mesh utilities (itemMeshUtils)

---

## Phase 7: Final Integration & Polish 🔄 IN PROGRESS

### Goal
Ensure all systems work together seamlessly.

### Completed
- ✅ All 6 tabs functional with shared Zustand state
- ✅ Sidebar navigation between tabs
- ✅ End-to-end workflow: Dashboard → Notes → Characters → Timeline → World → Scenes
- ✅ IndexedDB + localStorage persistence across all tabs
- ✅ Cel-shading renderer shared between Characters and Scenes

### Remaining
- [ ] AI integration (placeholder buttons exist; training spec written in `AI Training/`)
- [ ] Final UI consistency pass
- [ ] Performance optimization pass
- [ ] Bug fixes from testing

---

## Timeline Estimate

**Note**: No specific time estimates - work at your own pace.

**Order of Implementation**:
1. ~~Notes~~ → 2. ~~Characters~~ → 3. ~~Timeline~~ → 4. ~~World~~ → 5. ~~Scenes~~ → 6. Polish

---

*Document created: December 2024*
*Last updated: February 2025*
*For: Bibliarch MVP Development*
