/** Interior furniture catalog entries for building-level placement */

export interface FurnitureEntry {
  id: string
  name: string
  category: FurnitureCategory
  width: number
  depth: number
  height: number
  color: number
  snapMode: 'grid' | 'wall' | 'free'
}

export type FurnitureCategory =
  | 'seating'
  | 'tables'
  | 'beds'
  | 'storage'
  | 'kitchen'
  | 'bathroom'
  | 'lighting'

export const FURNITURE_CATEGORIES: { id: FurnitureCategory; label: string }[] = [
  { id: 'seating', label: 'Seating' },
  { id: 'tables', label: 'Tables' },
  { id: 'beds', label: 'Beds' },
  { id: 'storage', label: 'Storage' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'lighting', label: 'Lighting' },
]

export const FURNITURE_CATALOG: FurnitureEntry[] = [
  // Seating
  { id: 'chair', name: 'Chair', category: 'seating', width: 0.5, depth: 0.5, height: 0.9, color: 0x886644, snapMode: 'grid' },
  { id: 'sofa', name: 'Sofa', category: 'seating', width: 2.0, depth: 0.8, height: 0.85, color: 0x445566, snapMode: 'wall' },
  { id: 'bench', name: 'Bench', category: 'seating', width: 1.2, depth: 0.4, height: 0.45, color: 0x775533, snapMode: 'grid' },
  { id: 'armchair', name: 'Armchair', category: 'seating', width: 0.8, depth: 0.8, height: 0.9, color: 0x556644, snapMode: 'grid' },

  // Tables
  { id: 'dining-table', name: 'Dining Table', category: 'tables', width: 1.5, depth: 0.9, height: 0.75, color: 0x885522, snapMode: 'grid' },
  { id: 'desk', name: 'Desk', category: 'tables', width: 1.2, depth: 0.6, height: 0.75, color: 0x664422, snapMode: 'wall' },
  { id: 'coffee-table', name: 'Coffee Table', category: 'tables', width: 1.0, depth: 0.5, height: 0.4, color: 0x775533, snapMode: 'grid' },
  { id: 'nightstand', name: 'Nightstand', category: 'tables', width: 0.4, depth: 0.4, height: 0.6, color: 0x885544, snapMode: 'grid' },

  // Beds
  { id: 'single-bed', name: 'Single Bed', category: 'beds', width: 1.0, depth: 2.0, height: 0.5, color: 0xccbbaa, snapMode: 'wall' },
  { id: 'double-bed', name: 'Double Bed', category: 'beds', width: 1.6, depth: 2.0, height: 0.5, color: 0xccbbaa, snapMode: 'wall' },
  { id: 'bunk-bed', name: 'Bunk Bed', category: 'beds', width: 1.0, depth: 2.0, height: 1.8, color: 0x775533, snapMode: 'wall' },

  // Storage
  { id: 'shelf', name: 'Bookshelf', category: 'storage', width: 0.8, depth: 0.3, height: 1.8, color: 0x664422, snapMode: 'wall' },
  { id: 'cabinet', name: 'Cabinet', category: 'storage', width: 0.8, depth: 0.4, height: 0.9, color: 0x775533, snapMode: 'wall' },
  { id: 'dresser', name: 'Dresser', category: 'storage', width: 1.2, depth: 0.5, height: 0.8, color: 0x885544, snapMode: 'wall' },
  { id: 'wardrobe', name: 'Wardrobe', category: 'storage', width: 1.0, depth: 0.6, height: 2.2, color: 0x664433, snapMode: 'wall' },

  // Kitchen
  { id: 'counter', name: 'Counter', category: 'kitchen', width: 0.6, depth: 0.6, height: 0.9, color: 0x999999, snapMode: 'wall' },
  { id: 'fridge', name: 'Fridge', category: 'kitchen', width: 0.7, depth: 0.7, height: 1.8, color: 0xdddddd, snapMode: 'wall' },
  { id: 'stove', name: 'Stove', category: 'kitchen', width: 0.6, depth: 0.6, height: 0.9, color: 0x333333, snapMode: 'wall' },
  { id: 'sink', name: 'Sink', category: 'kitchen', width: 0.6, depth: 0.5, height: 0.85, color: 0xaaaaaa, snapMode: 'wall' },

  // Bathroom
  { id: 'toilet', name: 'Toilet', category: 'bathroom', width: 0.4, depth: 0.6, height: 0.4, color: 0xeeeeee, snapMode: 'wall' },
  { id: 'bathtub', name: 'Bathtub', category: 'bathroom', width: 0.7, depth: 1.7, height: 0.6, color: 0xeeeeee, snapMode: 'wall' },
  { id: 'shower', name: 'Shower', category: 'bathroom', width: 0.9, depth: 0.9, height: 2.2, color: 0xddddee, snapMode: 'wall' },
  { id: 'bath-sink', name: 'Bathroom Sink', category: 'bathroom', width: 0.5, depth: 0.4, height: 0.85, color: 0xeeeeee, snapMode: 'wall' },

  // Lighting
  { id: 'floor-lamp', name: 'Floor Lamp', category: 'lighting', width: 0.3, depth: 0.3, height: 1.6, color: 0xffeecc, snapMode: 'free' },
  { id: 'chandelier', name: 'Chandelier', category: 'lighting', width: 0.8, depth: 0.8, height: 0.5, color: 0xffdd88, snapMode: 'free' },
  { id: 'table-lamp', name: 'Table Lamp', category: 'lighting', width: 0.2, depth: 0.2, height: 0.4, color: 0xffeedd, snapMode: 'free' },
]

export function getFurnitureEntry(id: string): FurnitureEntry | undefined {
  return FURNITURE_CATALOG.find(e => e.id === id)
}

export function getFurnitureByCategory(category: FurnitureCategory): FurnitureEntry[] {
  return FURNITURE_CATALOG.filter(e => e.category === category)
}
