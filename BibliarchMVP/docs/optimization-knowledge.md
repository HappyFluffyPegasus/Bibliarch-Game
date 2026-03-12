# Optimization Knowledge — Large Open World Rendering

Research compiled for making BibliarchMVP support Genshin Impact-scale open worlds.

---

## 1. How Big Is Genshin's World Actually?

- **Total Teyvat playable land:** ~54 km² (excluding ocean)
- **Mondstadt region alone:** ~3-5 km² of traversable terrain
- **Full map width:** ~15.2 km
- **Mondstadt city:** only ~500 meters across
- **Walk from Mondstadt to Liyue:** ~70 minutes real-time, covering <2 km in-game
- The world is **intentionally scaled down 10-50x** from lore distances — standard practice for all open world games

**For comparison:**
| Game | Playable Area |
|------|-------------|
| Genshin (Mondstadt) | ~3-5 km² |
| GTA V | ~75 km² |
| Skyrim | ~37 km² |
| Breath of the Wild | ~84 km² |
| Elden Ring | ~79 km² |

**Our target: 4km x 4km = 16 km²** — this exceeds Mondstadt and gives room for varied landscape.

---

## 2. How Genshin Renders Without Lag

### Per-Frame Budget
- **500,000 to 850,000 triangles per frame** total (remarkably low for how good it looks)
- **Far render distance:** 800 meters
- Grass blades: 48-114 triangles per blade depending on LOD
- Bushes/tree canopies: 1,300-3,500 triangles each
- Grass instancing: up to **32 groups per single draw call**
- Up to 72 local light sources in certain scenes

### The Big Secret: Impostors / Billboard LOD

**Your friend is right.** Distant objects ARE rendered as flat 2D images. This technique is called **impostor rendering** or **billboard LOD**:

1. **Close objects (0-100m):** Full 3D mesh — all polygons rendered normally
2. **Medium objects (100-200m):** Simplified 3D mesh — reduced polygon count (LOD 1-2)
3. **Far objects (200m+):** **Billboard impostors** — a flat 2D image captured from the object's viewing angle, rendered on a simple quad facing the camera. Trees, rocks, buildings all become essentially flat cards

**How billboard impostors work:**
- An **octahedral impostor atlas** pre-renders the 3D object from 8-64 viewing angles
- At runtime, the game picks the atlas frame closest to the current viewing angle
- The result is a single textured quad (2 triangles) instead of thousands of triangles
- From a distance you literally cannot tell the difference

**For terrain specifically:**
- Close terrain: 1 vertex per meter (full detail)
- 200m away: 1 vertex per 4 meters
- 400m away: 1 vertex per 8 meters
- 800m away: 1 vertex per 16 meters
- The **horizon** beyond render distance is a pre-rendered skybox or extremely simplified mesh — basically a painted backdrop

This is why games look so good at a distance but pop-in happens when you get close — the 2D impostors swap to 3D meshes.

**Genshin's tree rendering:** Large leafy trees combine static geometry (trunk + branches) with **sprites** (flat leaf cards) — even the "full detail" version uses 2D sprites for leaves. At distance, the entire tree becomes a single billboard.

### Shadow System
- **8 cascaded shadow map cascades** (most games use 4)
- First 4 updated every frame, 5th alternates — saves GPU time
- Shadow GPU cost: 1.3-1.7ms after optimization

### Lighting
- **Clustered deferred lighting:** screen divided into 64×64×16 pixel cubes, 1024 tiles
- Volumetric fog voxels aligned with lighting grid
- G-Buffer: 3 RGBA textures + depth stencil

---

## 3. Core Techniques for Large Worlds

### 3.1 Chunked Terrain with LOD

Terrain is divided into a grid of **chunks** (64m or 128m each). Each chunk has its own heightmap, textures, and vegetation data.

**LOD levels for chunks (CDLOD algorithm):**

| LOD Level | Vertex Spacing | Range | Vertices per Chunk |
|-----------|---------------|-------|-------------------|
| 0 (finest) | 1m | 0-50m | 65×65 = 4,225 |
| 1 | 2m | 50-100m | 33×33 = 1,089 |
| 2 | 4m | 100-200m | 17×17 = 289 |
| 3 | 8m | 200-400m | 9×9 = 81 |
| 4 | 16m | 400-800m | 5×5 = 25 |

A 4km world at 64m chunks = **3,844 chunks total**, but only **100-200 loaded** at any time.

**CDLOD (Continuous Distance-Dependent LOD):**
- Build a quadtree over the heightmap
- Each frame, traverse the tree — subdivide nodes close to camera, stop subdividing distant ones
- All LOD patches share a **single reusable grid mesh** — vertex shader samples heightmap texture to displace vertices
- **Smooth morphing** between LOD levels: vertices gradually interpolate between fine/coarse positions in a transition zone, eliminating "popping"

```
morphFactor = clamp((distance - morphStart) / (morphEnd - morphStart), 0, 1)
vertexHeight = lerp(fineHeight, coarseHeight, morphFactor)
```

### 3.2 Chunk Streaming

Chunks load and unload based on player distance using a ring system:

| Ring | Distance | Detail Level | What's Loaded |
|------|----------|-------------|---------------|
| Immediate | 0-128m | Full detail | 65×65 heightmap, full textures, all vegetation |
| Near | 128-512m | Medium LOD | 33×33 heightmap, compressed textures, reduced vegetation |
| Far | 512-2000m | Low LOD | 17×17 heightmap, minimal textures, billboard impostors |
| Horizon | 2000m+ | Skybox/backdrop | Pre-rendered panorama or extremely simplified mesh |

**Async loading pipeline:**
1. Main thread detects which chunks need loading (cheap quadtree query)
2. **Web Workers** decompress heightmap data
3. Workers generate vertex buffer data (positions + normals)
4. Transfer back via `Transferable` (zero-copy)
5. Upload to GPU

**Pre-fetch:** Based on movement speed — walking pre-fetches 2 chunks ahead, running fetches 4 ahead.

### 3.3 Frustum Culling

Discard everything outside the camera's view. Each chunk/object has a bounding box. Test against the 6 frustum planes. **Eliminates 50-70% of geometry** before any pixel is drawn.

Three.js provides `Frustum.intersectsBox()` built-in. For terrain chunks, the AABB uses the chunk's XZ bounds + stored min/max height values from the heightmap.

### 3.4 Occlusion Culling (Hi-Z)

After a depth pre-pass, build a mip-chain of the depth buffer (each level = max depth of 2×2 block). For each object, project its bounding box to screen space, sample the Hi-Z mip — if the object is fully behind something closer, skip it.

Mountains hide the valley behind them. Buildings hide the alley behind them. This saves significant GPU work in worlds with vertical variation.

### 3.5 GPU Instancing

One draw call renders N copies of the same mesh with different transforms.

**In Three.js:**
```js
const mesh = new THREE.InstancedMesh(geometry, material, count);
mesh.setMatrixAt(index, matrix); // per-instance transform
```

- **Grass:** 48-114 tris/blade, 32 groups per draw call, driven by density maps
- **Trees (close):** Full mesh via InstancedMesh
- **Trees (far):** Billboard impostor via InstancedMesh with a quad geometry
- **Rocks/props:** InstancedMesh grouped by type

**BatchedMesh** (Three.js r163+) handles mixed geometry types with the same material in a single draw call — 90%+ draw call reduction.

### 3.6 Spatial Partitioning

**Quadtree** (best for terrain):
- Divides 2D space into 4 quadrants recursively
- 4km world: 8-10 levels deep (4096m → ... → 16m leaf nodes)
- Used for LOD selection and spatial queries

**Spatial Hashing** (best for objects):
- Hash `(x, z)` grid cell to a flat table
- O(1) lookup for "what objects are near this position?"
- `hash = (x * 73856093) ^ (z * 19349663) % tableSize`

**BVH** (for raycasting):
- Three.js already uses this internally for raycasting

---

## 4. What's Wrong with BibliarchMVP Right Now

### Current World Size
- **256×256 cells = 0.256 km²** — that's 1/20th of Mondstadt
- 16 chunks total, all always rendered at full detail
- And it's STILL slow

### Top Performance Bottlenecks (Ranked)

**1. No LOD / no distance culling**
Every chunk renders at full resolution always. At 4096×4096 that would be 4,096 draw calls with 17M vertices. Even at 1024×1024 it's 256 draw calls with 1.1M vertices — sluggish.

**2. Full geometry rebuild on terrain change**
`ChunkManager.setTerrain()` rebuilds ALL chunks when terrain data changes (new heightmap, cartography generate, level switch). Disposes old BufferGeometry, creates new one for every chunk. Freezes the UI.

**3. Object syncObjects() is scorched earth**
Disposes and recreates EVERY object mesh whenever the objects array or terrain reference changes. 100 trees = 100 fresh geometries + 100 fresh materials. Massive GC pressure.

**4. No instancing for objects**
100 trees = 100 draw calls with unique geometry/material. Should be 1 instanced draw call.

**5. Serialization doubles memory**
`Array.from(Float32Array)` to save to IndexedDB creates a JS number array copy. At 4096×4096 that's 80 MB typed arrays + 80 MB regular arrays + JSON overhead. Will crash the tab.

**6. Cartography generation blocks main thread**
Multiple O(n²) passes with no Web Worker. At 4096×4096 this would take many seconds, freezing everything.

**7. No spatial indexing for objects**
Raycasting iterates ALL objects. Selection, picking, collision are O(n).

**8. Terrain material is broken**
`createToonTerrainMaterial()` ignores toon-shading params and returns `MeshBasicMaterial`. No lighting on terrain.

**9. No texture splatmaps**
Materials baked as vertex colors at build time. No per-pixel blending between material types. Changing materials requires rebuilding chunks.

**10. No streaming / lazy loading**
All terrain data loaded into memory at once. No paging, no progressive detail.

### Memory Scaling

| Size | Cells | Heights | Materials | Total Data | Chunks | Vertices |
|------|-------|---------|-----------|-----------|--------|----------|
| 256×256 | 65K | 256 KB | 64 KB | 320 KB | 16 | 67K |
| 512×512 | 262K | 1 MB | 256 KB | 1.25 MB | 64 | 270K |
| 1024×1024 | 1M | 4 MB | 1 MB | 5 MB | 256 | 1.1M |
| 2048×2048 | 4M | 16 MB | 4 MB | 20 MB | 1024 | 4.3M |
| 4096×4096 | 16M | 64 MB | 16 MB | 80 MB | 4096 | 17M |

---

## 5. Floating Point Precision

IEEE 754 32-bit floats have ~7 decimal digits of precision.

| Distance from Origin | Precision | Effect |
|---------------------|-----------|--------|
| 100m | 0.00001m | Perfect |
| 1,000m | 0.0001m | Fine |
| 4,000m | 0.0005m | Fine |
| 10,000m | 0.001m | Barely acceptable |
| 100,000m | 0.01m | Visible jitter |

**For a 4km world: no special handling needed.** Worst case is 0.5mm precision at the corners.

If we ever go beyond 10km, use **camera-relative rendering** — subtract camera position from all objects before sending to GPU, so all GPU math happens near origin.

---

## 6. Implementation Plan for BibliarchMVP

Priority order for upgrading the world system:

### Phase 1: Fix Current Performance (keep 256×256 default)
1. **Fix object instancing** — group objects by type, use `InstancedMesh` instead of individual meshes
2. **Fix syncObjects** — incremental updates (add/remove/move individual objects) instead of scorched-earth rebuild
3. **Fix setTerrain** — update vertex buffers in-place instead of disposing and rebuilding BufferGeometry
4. **Fix terrain material** — use actual toon/lit material instead of MeshBasicMaterial
5. **Add frustum culling** per chunk with proper bounding boxes including min/max heights

### Phase 2: Scale Up (support 1024×1024 to 4096×4096)
6. **Quadtree LOD** — distant chunks use fewer vertices (CDLOD algorithm)
7. **Chunk streaming** — only load nearby chunks, page distant ones to IndexedDB
8. **Web Workers** for terrain generation, cartography, serialization
9. **Binary serialization** — structured clone of typed arrays directly, no JSON conversion

### Phase 3: Polish (Genshin-quality render distance)
10. **Billboard impostors** for distant trees/objects
11. **Splatmap textures** for terrain material blending at cell boundaries
12. **Vegetation density maps** — GPU instanced grass/bushes per chunk
13. **Cascaded shadow maps** (3-4 cascades)

---

## 7. Three.js Specific Resources

**Existing Three.js open world projects:**
- [OpenWorldJS](https://github.com/obecerra3/OpenWorldJS) — CDLOD terrain in Three.js
- [geo-three](https://github.com/tentone/geo-three) — Quadtree LOD with tile streaming
- [THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain) — Procedural terrain generation

**Key Three.js APIs:**
- `InstancedMesh` — same geometry, many instances, 1 draw call
- `BatchedMesh` (r163+) — mixed geometry, same material, 1 draw call
- `LOD` class — automatic distance-based model switching
- `Frustum.intersectsBox()` — built-in frustum culling test
- `WebGPURenderer` (r171+) — 2-10x improvement for draw-call-heavy scenes, with WebGL 2 fallback

**Frame budget for terrain in browser:**
| System | WebGPU | WebGL 2 |
|--------|--------|---------|
| Terrain geometry | 1.5ms | 3.5ms |
| Vegetation cull + render | 1.5ms | 3.0ms |
| Shadows (3-4 cascades) | 0.5ms | 1.0ms |
| **Total terrain** | **3.5ms** | **6.5ms** |
| % of 16.6ms frame (60fps) | 21% | 39% |

---

## Sources

- [Genshin Impact Console Rendering Pipeline](https://nugglet.github.io/posts/2022/12/console_graphics_rendering_pipeline_genshin_impact)
- [The Art of Game Rendering: Genshin Impact Deep Dive](https://parsers.vc/news/250124-the-art-of-game-rendering--a-deep-dive-into/)
- [Genshin Impact 3D Model Optimization for Mobile](https://www.animaticsassetstore.com/2024/09/13/how-genshin-impact-3d-models-are-optimized-for-mobile-performance/)
- [CDLOD Paper (Filip Strugar)](https://github.com/fstrugar/CDLOD)
- [Geometry Clipmaps (Hoppe)](https://hhoppe.com/proj/geomclipmap/)
- [Landscape Generation for Browser Open Worlds (Cinevva)](https://app.cinevva.com/guides/landscape-generation-browser)
- [Chunk Streaming System Report (PDF)](https://www.charlieevans.dev/documents/OpenWorldStreamingReport.pdf)
- [NVIDIA GPU Gems: Efficient Occlusion Culling](https://developer.nvidia.com/gpugems/gpugems/part-v-performance-and-practicalities/chapter-29-efficient-occlusion-culling)
- [NVIDIA GPU Gems 3: True Impostors](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-21-true-impostors)
- [Hi-Z Occlusion Culling](https://www.nickdarnell.com/hierarchical-z-buffer-occlusion-culling/)
- [Two-Pass Occlusion Culling](https://medium.com/@mil_kru/two-pass-occlusion-culling-4100edcad501)
- [Game Programming Patterns: Spatial Partition](https://gameprogrammingpatterns.com/spatial-partition.html)
- [Inside Game Development: Using Impostors](https://80.lv/articles/inside-game-development-using-impostors)
- [Far Away Objects in Open World Games (GameDev.net)](https://www.gamedev.net/forums/topic/711289-far-away-objects-and-horizon-in-an-open-world-game/)
- [Impostor Baker Plugin (Unreal Engine)](https://dev.epicgames.com/documentation/en-us/unreal-engine/impostor-baker-plugin-in-unreal-engine)
- [OpenWorldJS (Three.js CDLOD)](https://github.com/obecerra3/OpenWorldJS)
