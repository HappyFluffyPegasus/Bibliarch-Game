# Bibliarch — Quality Expectations

> Quality standards, UX expectations, and acceptance criteria derived from creator interviews (February 2026).
> These define "what good looks like" across the product.

---

## Reference Baselines

Every feature has a real-world reference product. The baseline expectation is: **copy the exact quality of the reference first.** Only improve beyond the reference with explicit permission. If the reference does something well, Bibliarch must do it at least as well.

| Feature Area | Reference Product | What to Copy |
|-------------|-------------------|--------------|
| World Builder UI | **Roblox Studio** | Ribbon toolbar, tabbed feature categories (terrain / building / objects / testing), dockable panels, Explorer tree, Properties panel. Copy the exact layout and organization. |
| World Builder Terraforming | **Roblox Studio** | Terrain sculpting tools, brush sizes, material painting, smooth/flatten operations. Match the quality and feel of Roblox terrain editing. |
| Game Engine Feel | **Unity** | Transform gizmos (Move arrows, Scale boxes, Rotate rings), viewport navigation, object selection and manipulation. The world builder should feel like making a map in Unity. |
| Building System | **The Sims 4** | Wall placement, room creation, lot system, interior decoration, furniture placement. The building experience should match Sims 4 quality. |
| Map Quality & Scale | **Genshin Impact** | World should feel vast and explorable. The minimap should be detailed and accurate. When a character walks through the world it should feel like a real open-world game, not a tiny diorama. |
| Scenes Timeline | **CapCut** | Video editing timeline, track-based editing, drag-and-drop clips, playback controls. The scene editing experience should feel like editing a video in CapCut. |
| Notes Canvas | **Miro** | Freeform canvas, infinite scroll, drag-and-drop text boxes, spatial organization. Should feel like a Miro board. |
| Character Creator | **Any standard game character creator** | Centered 3D preview, side panels for options, category tabs (hair, face, body, clothes). Nothing groundbreaking needed — just match industry standard. |

---

## General Quality Standards

### Zero Technical Skill Required
- Users should never need 3D modeling, coding, or video editing knowledge
- The character creator is asset-based — users pick from pre-made parts and customize colors
- Scene generation is entirely text-prompt-driven
- World building uses a visual editor with preset objects, not manual modeling
- The only "skill" required is writing (notes, prompts, descriptions)

### Familiar UX Patterns
- Each tab must feel immediately recognizable to users who have used the reference tool
- If a user has used Roblox Studio, they should navigate the World Builder without a tutorial
- If a user has used CapCut, they should navigate the Scenes tab without a tutorial
- If a user has used Miro, they should navigate the Notes tab without a tutorial

### No Clutter
- Features must be organized into categories/tabs — never crowded onto one screen
- The Roblox Studio ribbon pattern is the model: terrain tools in one tab, building tools in another, etc.
- Nothing overlapping or confusing
- UI quality on par with the current Bibliarch website

### CRITICAL: Text Contrast Rule
**This is the single most important UI quality rule. Violation is unacceptable.**

- Text and background must ALWAYS have at least 60–80% contrast difference
- NEVER white text on white background
- NEVER light text on light background
- This applies to ALL elements: buttons, dropdowns, dialogs, labels, sub-tabs
- Button pairs (Cancel / Confirm) must BOTH be readable — one button having correct styling does not excuse the other having unreadable text
- Dropdown menu items must be readable without hovering
- Dialog text must be readable without hovering

**Known violations to fix:**
| Element | Location | Issue |
|---------|----------|-------|
| "Add Event" button | Timeline tab | White text on white background |
| "Save Location" button | World tab | White text on white background |
| "Generate with AI" dialog | Scenes tab | White text on white background |
| Daylight cycle dropdown | Scenes tab | White background with light blue text |
| Various sub-tab labels | Scenes tab | Low contrast |

---

## Per-Feature Quality

### Homepage / Dashboard
| Criterion | Expectation |
|-----------|-------------|
| Card layout | Portrait-oriented (taller than wide) like book covers |
| Card content | Title at top, short description (character-limited), optional cover image |
| Visual identity | No randomly assigned colors — stories don't have accent colors unless the user chose them |
| Overall feel | Like browsing a bookshelf of your projects |

### AI Scene Generation
| Criterion | Expectation |
|-----------|-------------|
| Generation speed | As fast as possible — the creator explicitly wants minimal wait time |
| Scene length | 5–10 minutes per scene |
| Scene accuracy | Characters act according to their documented personality, relationships, and timeline context |
| Rewatchability | Scenes are optionally saveable and can be replayed |
| Editability | Generated scenes appear in a CapCut-style timeline and can be manually adjusted |
| AI behavior | AI NEVER gives story advice or dictates plot; it only executes what the user describes or what the timeline implies |
| Context fidelity | AI must use notes, character metadata, relationships (including strength and one-sidedness), timeline event states, and master documents |

### Character Creator
| Criterion | Expectation |
|-----------|-------------|
| Visual quality | Cel-shaded with custom toon materials — characters look stylized, not flat |
| Hair quality | Textured (not flat) using the undertone system with texture picker |
| Animation quality | Characters animate without distortion when shape keys are applied |
| Color flexibility | Full free color picker for hair, skin, and eyes — no preset-only palettes |
| Asset rigging | Hair and clothes must rig correctly on export — this is a known issue that needs resolution |
| Operations | Create, delete (with confirmation dialog), rename |
| Notes integration | Bidirectional linking between 3D characters and note characters — creating one offers to create the other |

### World Building
| Criterion | Expectation | Reference |
|-----------|-------------|-----------|
| UI quality | Exact copy of Roblox Studio's ribbon toolbar and panel layout | Roblox Studio |
| Terraforming quality | Matches Roblox Studio terrain editing — smooth, responsive brush tools | Roblox Studio |
| Transform gizmos | Move/Scale/Rotate handles identical to Unity's gizmo system | Unity |
| Building system | Wall/room/lot placement matches The Sims 4 quality | The Sims 4 |
| Scale | World feels as large and explorable as Genshin Impact's map | Genshin Impact |
| Minimap accuracy | 2D map textures ALWAYS match 3D terrain — grass shows as grass, water as water | Genshin Impact |
| Hierarchy | Smooth drill-down from World → Country → City → Building **under 2 seconds** — no 20-second waits, no loading failures | — |
| Terrain propagation | Edits at any level **MUST** update all other levels — a mound on the world map appears inside the country | — |
| Object placement | Library of preset objects that can be placed, moved, and deleted | — |
| Multi-select | Shift-click, ctrl-click, and marquee/box select for bulk operations — never require individual selection to delete multiple objects | Unity / Roblox Studio |
| Lot system | Buildings on lots can be duplicated | The Sims 4 |
| Scaling dummy | Dedicated button to place a reference character for scale checking | — |
| Environment tab | Fully functional and **unified** — one combined system for lighting, sky, water, fog, weather. Day/night affects everything (land + sky + water), not just land. | — |
| Weather rendering | Rain, snow, fog, and clouds render at **all zoom levels**, not just when zoomed out | — |
| Border accuracy | Drawn borders preserve exact polygon shape — triangles stay triangles, never forced into rectangles | — |
| Border feedback | Real-time line preview as border points are placed — user must see what they're drawing | — |
| Explorer ↔ Properties | Clicking any item in Explorer shows its properties. Terrain entry in Explorer shows sculpt/paint tools. | Roblox Studio |
| Item library | Standalone items/elements can be saved and placed into any hierarchy level — projects within projects | Alight Motion |
| Build tab completeness | All tools visible and organized: objects, regions, lots, roads, walls, doors, floors, furniture | Roblox Studio |
| No dead-end buttons | No "Add Country" buttons or "Coming Soon" buttons — if a button exists, it works | — |

### Notes Tab
| Criterion | Expectation |
|-----------|-------------|
| Canvas feel | Freeform like Miro — not a linear document, not a form |
| Flexibility | All fields optional, no word limits, no forced structure |
| Template system | Starting templates provided but fully removable |
| Import | Upload external .md/.txt/.docx — stored as raw text, no auto-formatting |
| Master doc access | Easy to browse and access uploaded master documents |
| Upload button | Must work (currently broken) |
| Completeness | This tab is mostly done — quality bar is the existing Bibliarch website |

### Timeline Tab
| Criterion | Expectation |
|-----------|-------------|
| Layout | Horizontal tracks like video editing — visually clear parallel tracks |
| Interaction | Blocks can be moved, typed in, nested (arcs containing events) |
| Linking | Bidirectional links between timeline events and scenes |
| Structure | More structured than the notes tab — this is why it's a separate tab |
| Drag behavior | Always works, always shows visual feedback during drag |
| Overlap prevention | Events on the same track cannot overlap — must be blocked or snapped |
| Track independence | Sub-event tracks are independent — deleting inside a sub-event doesn't affect parent |

### Scenes Tab
| Criterion | Expectation |
|-----------|-------------|
| Default state | Scene list sidebar closed by default — viewport fills the screen |
| Layout | No blank space when sidebar is closed |
| Scene browsing | Scene Overview panel is the primary browser |
| New Scene | Single button in top-right corner — no duplicate buttons |
| Camera view | Exiting camera view returns user to their previous user camera position |
| Props | No "Add Prop" button — props come from the world builder |
| Dropdowns | All dropdown text is readable (not white/light on white) |
| AI dialog | "Generate with AI" dialog has readable text |

### Relationships
| Criterion | Expectation |
|-----------|-------------|
| Description | Free-form text, not preset labels — captures full nuance |
| Directionality | One-sided relationships supported — A's view of B can differ from B's view of A |
| Strength | 1–3 scale that meaningfully affects AI scene generation |
| Evolution | States per timeline event — relationships change over time |
| Visualization | Users can see how their characters connect visually (relationship chart) |

---

## Performance Quality

### Scene Generation
- As fast as possible — the creator listed speed as a top priority
- No specific frame/time target given, but the implication is "seconds, not minutes" for generation start

### 3D Rendering
- Stable 60fps with vsync (per existing PRD)
- Cel-shading must render correctly without visual artifacts

### World Hierarchy Navigation
- **Under 2 seconds** to enter or exit any hierarchy level (World ↔ Country ↔ City ↔ Building)
- Current state: 20+ seconds, sometimes fails entirely — this is the #1 performance issue
- Terrain state MUST be preserved during navigation — never reset to flat
- Camera should start at a reasonable overview zoom, not super zoomed in

### World Scale
- The world map must feel appropriately large — this is a known quality issue in the current build
- Characters should be proportional to the world at every drill-down level
- Genshin Impact is the scale reference

### Weather Rendering
- Rain, snow, fog, and cloud effects must render at all camera distances
- Current state: particles only visible when zoomed way out — completely invisible at normal working zoom

---

## What "Done" Does NOT Mean

The creator explicitly called out that features marked "done" may not be polished:

> "It has a lot of the framework for it, but it's not polished."

"Done" in the creator's vocabulary means the code structure and basic functionality exist, NOT that the feature meets quality expectations. Every "done" feature should be evaluated against the criteria in this document before being considered shipping-quality.

---

## Known Issues Requiring Resolution

| Issue | Tab | Severity |
|-------|-----|----------|
| **Terrain doesn't propagate between hierarchy levels** — mound on world map invisible inside country | World Building | **Critical** |
| **Hierarchy navigation takes 20+ seconds** — sometimes fails to load entirely | World Building | **Critical** |
| **Terrain randomly resets to flat plane** after navigating back from a country | World Building | **Critical** |
| **Borders forced into rectangles** — drawing a triangle becomes a bounding box | World Building | **Critical** |
| **No visual feedback when drawing borders** — user clicks blind | World Building | **Critical** |
| **Day/night only affects land** — sky and water don't change color | World Building | **Critical** |
| White text on white background (multiple buttons/dialogs) | Timeline, World, Scenes | **Critical** |
| Low contrast dropdown text | Scenes | **Critical** |
| **Build tab nearly empty** — missing objects, buildings, lots, roads, walls, etc. | World Building | High |
| **No multi-select** — must individually click each object to delete | World Building | High |
| **Objects dropdown truncated** — can't see all available objects | World Building | High |
| **"Add Country" button in Explorer** — does nothing, should be removed | World Building | High |
| **"Add Country" button in Regions area** — does nothing, should be removed | World Building | High |
| **Rain/snow only render when zoomed out** — invisible at normal zoom | World Building | High |
| **Fog weather button does nothing** — just changes water color | World Building | High |
| **Cloudy weather shows no clouds** — no visible effect | World Building | High |
| **Two separate fog controls** — one works, one doesn't. Confusing. | World Building | High |
| **Sky color disconnected from day/night** — should be one combined system | World Building | High |
| **Camera starts super zoomed in** when entering a country | World Building | High |
| **Enters wrong country** — hierarchy navigation goes to incorrect region | World Building | High |
| **No Terrain entry in Explorer** — can't click to get terrain tools in Properties | World Building | High |
| **Explorer clicks don't populate Properties panel** | World Building | High |
| Upload Master Doc button broken | Notes | High |
| No easy way to browse uploaded master docs | Notes | High |
| Hair can't be rigged as desired on export | Characters | High |
| Clothes may have the same rigging issue | Characters | High (unconfirmed) |
| World map feels too small | World Building | High |
| 2D minimap doesn't match 3D terrain textures | World Building | High |
| Event drag sometimes doesn't work / no visual feedback | Timeline | High |
| Events can overlap on same track | Timeline | High |
| Track deletion in sub-events affects parent | Timeline | High |
| Scene sidebar leaves blank space when closed | Scenes | Medium |
| Scene sidebar open by default | Scenes | Medium |
| Camera view exit doesn't restore previous position | Scenes | Medium |
| UI decision-making is a persistent struggle | All tabs | Medium |
| Shape key + animation distortion | Characters | High (workaround exists) |
| "Relationship type" vs "relationship state type" distinction unclear | Relationships | Low |
| Items tab still exists (should be deleted) | Items | High |
