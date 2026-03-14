# World Builder — Feedback & Ideas

## Feedback (Q&A)

---

### 1. Camera Starts Below the Map

**Problem:** When entering the world area, the camera spawns below the terrain. It's technically above the grid, but the terrain sits higher so you're looking at the underside.

**Why it's a problem:** The first thing a player sees is void or the bottom of the map. Completely disorienting.

**Who struggles:** First-time users, younger players, anyone unfamiliar with 3D editors.

**How to fix:** Set default camera Y relative to the terrain surface, not the grid. Something like `cameraY = maxTerrainHeight + 60`. Also add a "Focus on World" button or auto-frame camera to terrain bounds on load.

---

### 2. No Area Creation Workflow (Drop Straight Into Editor)

**Problem:** There's no start screen — you're dropped directly into the world editor. There should be an overview screen like the Scenes tab has with "Create Scene."

**Why it's a problem:** The core philosophy is letting people work at their own pace. Some people want to build a bedroom, not a planet. Right now it assumes everyone starts with a full world.

**Who struggles:** Story-first creators who just need an interior, casual users, anyone who doesn't want to build top-down.

**How to fix:** Add a creation flow:
- Overview screen with "Create Area" button
- Choose hierarchy level: **World → Country → City → Building/Interior**
- Each level opens the appropriate editor scope
- Players can start anywhere in the hierarchy

---

### 4. Can't Place Objects in World Level

**Problem:** At the world level, placing objects doesn't work at all.

**Why it's a problem:** Empty world with no way to populate it.

**Who struggles:** Everyone trying to build at world scale.

**How to fix:** Either enable object placement at world level or clearly communicate that objects are placed at city/building level. Consider which levels should support what tools.

---

### 5. Country Borders Are Ugly and Hard to Use

**Problem:** Country borders use polyline drawing which creates messy shapes. Hard to select countries too.

**Why it's a problem:** Political/regional boundaries are a core world-building feature. If they look bad and are hard to edit, people won't use them.

**Who struggles:** Fantasy mapmakers, political world builders, strategy-style creators.

**How to fix:** Options:
- **Polygon tool:** Click vertices, auto-close shape, drag to adjust
- **Region paint:** Brush-paint territory like a map editor
- **Editable shape:** Drag handles, smooth curves, adjustable borders
- Show the full selected area clearly (fill/highlight)

---

### 6. Lot Size Is Randomized

**Problem:** When placing lots, sizes are randomized with no way to control dimensions.

**Why it's a problem:** City layout requires precision. Random sizes make intentional design impossible.

**Who struggles:** City builders, architecture designers, layout planners.

**How to fix:** Add a drag-to-size tool: click start corner → drag → release at end corner. Show dimensions while dragging.

---

### 7. Lots and Buildings Are Confusing at City Level

**Problem:** Lots and buildings feel like the same thing at city level. Can enter a building but not a lot. Confusing hierarchy.

**Why it's a problem:** Users don't understand the distinction or how to navigate into their spaces.

**Who struggles:** Everyone at city level.

**How to fix:** At city level, lots and buildings should be unified — a lot IS the container you enter. Entering a lot opens the building/interior editor for that space.

---

### 8. Roads — Sharp Bends Create Artifacts

**Problem:** When roads bend sharply, the geometry gets messy/distorted.

**Why it's a problem:** Looks broken, especially on highways.

**Who struggles:** Anyone making realistic road layouts.

**How to fix:** Add spline interpolation / curve smoothing for sharp angles. Catmull-Rom or Bezier curves between waypoints.

---

### 9. Roads — Can't Intersect

**Problem:** Two roads can't connect/merge into each other. No intersection support.

**Why it's a problem:** Real road networks need intersections. Without them, you can only make disconnected paths.

**Who struggles:** Anyone building a city with more than one road.

**How to fix:** Add intersection snapping — road endpoints detect nearby roads and create proper junctions. T-intersections and 4-way crosses at minimum.

---

### 10. Roads — No Live Preview While Drawing

**Problem:** When placing road waypoints, you only see the dots, not how the final road will look.

**Why it's a problem:** You're drawing blind. Can't tell if the road will look right until you finish.

**Who struggles:** Everyone placing roads.

**How to fix:** Show a live road mesh preview that updates as you place each waypoint. Same fix needed for walls.

---

### 11. Roads — Can't Delete, Don't Show in Objects Panel

**Problem:** Delete key doesn't work on roads. They don't appear in the Objects tab.

**Why it's a problem:** Can't edit or remove mistakes. Basic editing is broken.

**Who struggles:** Everyone.

**How to fix:** Roads must appear in the Objects panel — selectable, deletable, editable.

---

### 12. Roads — Generally Great

**Positive feedback:** Road types (highway, main, alley, footpath) work well. Visual quality is good. Highway scaling feels correct. The road system is genuinely impressive.

---

### 13. Walls — Should Support Drag Placement

**Problem:** Walls are placed point-to-point, but users expect click-drag.

**Why it's a problem:** Point-to-point is less intuitive for most people.

**Who struggles:** Casual builders, Bloxburg/Sims players.

**How to fix:** Support both modes:
- **Click → Click** (current)
- **Click → Drag → Release** (new, default)
Show a live wall preview while dragging.

---

### 14. Walls — No Grid Snapping

**Problem:** Walls (and other building tools) don't snap to grid.

**Why it's a problem:** Precise building is nearly impossible without grid snap.

**Who struggles:** Anyone building interiors.

**How to fix:** Add a toggle: `Snap to Grid: ON / OFF`. Apply to walls, floors, furniture, doors.

---

### 15. Floor Placement — One Tile at a Time

**Problem:** Floors are painted one tile at a time. Extremely slow.

**Why it's a problem:** Filling a room takes forever.

**Who struggles:** Everyone building interiors.

**How to fix:** Add drag-to-fill: click start → drag → release fills the rectangle. Similar to Bloxburg floor placement where you click corners to define the area.

---

### 16. Doors Not Working

**Problem:** Can't place doors on walls.

**Why it's a problem:** Can't build functional interiors.

**How to fix:** Use temporary placeholder models (colored boxes) until final assets exist. The placement system needs to detect wall segments and insert the door into them.

---

### 17. Furniture Not Working

**Problem:** Chair, sofa, bench — none of them place.

**Why it's a problem:** Can't furnish interiors at all.

**How to fix:** Use temporary placeholder geometry (colored boxes with labels) for all furniture until models are ready. Focus on getting the placement/transform system working.

---

### 18. Multi-Floor — Wall Height Breaks Upper Floors

**Problem:** Changing wall height on one floor means the next floor doesn't align. Short walls and tall walls on the same floor create mismatched upper levels.

**Why it's a problem:** Can't build split-level or varied-height interiors.

**Who struggles:** Anyone building complex buildings.

**How to fix:** Implement half-floor logic:
- Floor 1: short wall area + tall wall area
- Floor 1.5: level above short walls
- Floor 2: level above tall walls
The system should track elevation per-region, not per-floor-number.

---

### 19. Floor Visibility — Can't See Other Floors While Editing

**Problem:** When editing a floor, you can't see floors above or below.

**Why it's a problem:** Lose context of the full building layout.

**Who struggles:** Anyone building multi-story.

**How to fix:** Add visibility toggles:
- Show floors above (transparent)
- Show floors below (transparent)
- Hide upper floors
- Full opacity / semi-transparent / hidden

---

### 20. Terrain Not Showing at Building Level

**Problem:** When entering the building editor, terrain disappears.

**Why it's a problem:** Lose sense of place and context.

**How to fix:** Keep terrain visible (or a simplified version) at building level as ground reference.


## Approved Ideas — Claude

1. **Undo/redo stack for all world edits** — critical for any editor, lets people experiment without fear
2. **Copy/paste buildings between lots** — design once, reuse everywhere
3. **Road auto-connect** — drag a road near another road and it automatically creates an intersection node
4. **Terrain stamp brushes** — premade shapes (crater, hill, cliff, valley) that stamp onto terrain in one click
5. **Interior templates** — preset room layouts (bedroom, kitchen, classroom) that drop in as starting points
6. **Photo mode** — freeze the world, free camera, depth of field, take screenshots for story reference
7. **Day/night cycle preview** — scrub a time slider to see how lighting changes across the day
8. **Measurement tool** — click two points, see the distance. Essential for consistent building
9. **World map export** — render a top-down image of your world as a 2D map
10. **Lot auto-subdivision** — draw a city block, auto-divide it into lots based on road frontage
11. **Paint terrain materials with a fill bucket** — select a region, fill it instead of brush-painting every tile
12. **Wall material/color picker** — paint walls different colors/textures per-face
13. **Furniture snap points** — chairs snap to tables, beds snap to walls, etc.
15. **Save/load building blueprints** — save a building design as a reusable template
16. **Street naming** — label roads and have names show on the map view
17. **Minimap overlay** — small corner map showing your position in the world while editing
18. **Object search/filter in Objects panel** — search by name, type, or filter by category
19. **Terrain erosion brush** — natural-looking terrain sculpting that simulates water erosion patterns
20. **Quick-test walkthrough** — first-person walk through your building to check scale and feel, like the existing fly mode but specifically for interiors

---

## Approved Ideas — ChatGPT

1. Auto-generated terrain tools (mountains, rivers)
5. Procedural building generator
6. District zoning system
7. Story location tagging (important location, battle location, home)
8. World timeline events (Year 200: war begins)
9. NPC population generator
10. Climate simulation
13. Procedural coastlines
15. Drag-to-duplicate buildings
19. World heatmap overlays (population, economy, magic density) (THIS ONE IS A MAJOR YES)
