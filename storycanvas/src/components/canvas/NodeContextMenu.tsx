import React, { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  // General icons
  FileText, File, ClipboardList, Pin, Paperclip, Bookmark, Lightbulb, Star, Sparkles, Zap,
  // Object icons
  Folder, FolderOpen, Book, BookOpen, Library, Archive, Package, Box, Notebook, FileStack,
  // Symbol icons
  Heart, Circle, Square, Triangle, Diamond, Hexagon, Octagon, Pentagon, Check, X,
  // Nature icons
  Sun, Moon, Cloud, Snowflake, Flame, Droplet, Flower, Leaf, TreeDeciduous, Mountain,
  // Activity icons
  Gamepad2, Palette, Drama, Film, Mic, Music, Dice5, Trophy, Sword, Shield,
  // People icons
  User, Users, UserCircle, Crown, Skull, Ghost, Bot, Orbit, Wand2, Baby,
  // Animal/creature icons
  Bird, Bug, Cat, Dog, Fish, Rabbit, Snail, Turtle, Squirrel, Rat,
  // Misc icons
  Castle, Home, Building, Gem, Key, Crosshair, Target, Map, ScrollText, Compass,
  // Additional useful icons
  Calendar, MapPin, List, ImageIcon, Table, type LucideIcon
} from 'lucide-react'
import { Node } from '../../types'

// Icon options using Lucide React icons
const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  // General
  { name: 'FileText', icon: FileText },
  { name: 'File', icon: File },
  { name: 'ClipboardList', icon: ClipboardList },
  { name: 'Pin', icon: Pin },
  { name: 'Paperclip', icon: Paperclip },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Star', icon: Star },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Zap', icon: Zap },
  // Objects
  { name: 'Folder', icon: Folder },
  { name: 'FolderOpen', icon: FolderOpen },
  { name: 'Book', icon: Book },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Library', icon: Library },
  { name: 'Archive', icon: Archive },
  { name: 'Package', icon: Package },
  { name: 'Box', icon: Box },
  { name: 'Notebook', icon: Notebook },
  { name: 'FileStack', icon: FileStack },
  // Symbols
  { name: 'Heart', icon: Heart },
  { name: 'Circle', icon: Circle },
  { name: 'Square', icon: Square },
  { name: 'Triangle', icon: Triangle },
  { name: 'Diamond', icon: Diamond },
  { name: 'Hexagon', icon: Hexagon },
  { name: 'Octagon', icon: Octagon },
  { name: 'Pentagon', icon: Pentagon },
  { name: 'Check', icon: Check },
  { name: 'X', icon: X },
  // Nature
  { name: 'Sun', icon: Sun },
  { name: 'Moon', icon: Moon },
  { name: 'Cloud', icon: Cloud },
  { name: 'Snowflake', icon: Snowflake },
  { name: 'Flame', icon: Flame },
  { name: 'Droplet', icon: Droplet },
  { name: 'Flower', icon: Flower },
  { name: 'Leaf', icon: Leaf },
  { name: 'TreeDeciduous', icon: TreeDeciduous },
  { name: 'Mountain', icon: Mountain },
  // Activities
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Palette', icon: Palette },
  { name: 'Drama', icon: Drama },
  { name: 'Film', icon: Film },
  { name: 'Mic', icon: Mic },
  { name: 'Music', icon: Music },
  { name: 'Dice5', icon: Dice5 },
  { name: 'Trophy', icon: Trophy },
  { name: 'Sword', icon: Sword },
  { name: 'Shield', icon: Shield },
  // People
  { name: 'User', icon: User },
  { name: 'Users', icon: Users },
  { name: 'UserCircle', icon: UserCircle },
  { name: 'Crown', icon: Crown },
  { name: 'Skull', icon: Skull },
  { name: 'Ghost', icon: Ghost },
  { name: 'Bot', icon: Bot },
  { name: 'Orbit', icon: Orbit },
  { name: 'Wand2', icon: Wand2 },
  { name: 'Baby', icon: Baby },
  // Animals
  { name: 'Bird', icon: Bird },
  { name: 'Bug', icon: Bug },
  { name: 'Cat', icon: Cat },
  { name: 'Dog', icon: Dog },
  { name: 'Fish', icon: Fish },
  { name: 'Rabbit', icon: Rabbit },
  { name: 'Snail', icon: Snail },
  { name: 'Turtle', icon: Turtle },
  { name: 'Squirrel', icon: Squirrel },
  { name: 'Rat', icon: Rat },
  // Misc
  { name: 'Castle', icon: Castle },
  { name: 'Home', icon: Home },
  { name: 'Building', icon: Building },
  { name: 'Gem', icon: Gem },
  { name: 'Key', icon: Key },
  { name: 'Crosshair', icon: Crosshair },
  { name: 'Target', icon: Target },
  { name: 'Map', icon: Map },
  { name: 'ScrollText', icon: ScrollText },
  { name: 'Compass', icon: Compass },
]

// Map icon names to components for rendering saved icons
const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map(opt => [opt.name, opt.icon])
)

// Get the Lucide icon component by name
export const getIconByName = (name: string): LucideIcon | null => {
  return ICON_MAP[name] || null
}

// Icon picker component
const IconPicker = ({
  currentIcon,
  nodeType,
  onSelect,
  isReady
}: {
  currentIcon?: string
  nodeType?: string
  onSelect: (icon: string | null) => void
  isReady: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get current icon component
  const CurrentIconComponent = currentIcon ? ICON_MAP[currentIcon] : null

  if (!isExpanded) {
    return (
      <button
        className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent active:bg-accent transition-colors text-foreground flex items-center justify-between"
        onClick={() => {
          if (!isReady) return
          setIsExpanded(true)
        }}
        onTouchEnd={(e) => {
          if (!isReady) return
          e.preventDefault()
          setIsExpanded(true)
        }}
      >
        <span className="flex items-center gap-2">
          {CurrentIconComponent ? <CurrentIconComponent className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          <span>Change Icon</span>
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Select Icon</span>
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (!isReady) return
            onSelect(null) // Reset to default
          }}
          onTouchEnd={(e) => {
            if (!isReady) return
            e.preventDefault()
            onSelect(null)
          }}
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto">
        {ICON_OPTIONS.map((opt) => {
          const IconComponent = opt.icon
          return (
            <button
              key={opt.name}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-accent active:bg-accent ${currentIcon === opt.name ? 'bg-primary/20 ring-1 ring-primary' : ''}`}
              onClick={() => {
                if (!isReady) return
                onSelect(opt.name)
              }}
              onTouchEnd={(e) => {
                if (!isReady) return
                e.preventDefault()
                onSelect(opt.name)
              }}
              title={opt.name}
            >
              <IconComponent className="w-4 h-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface NodeContextMenuProps {
  node: Node
  position: { x: number; y: number }
  onClose: () => void
  onSettingChange: (nodeId: string, setting: string, value: any) => void
  onDuplicate: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onBringToFront: (nodeId: string) => void
  onSendToBack: (nodeId: string) => void
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  node,
  position,
  onClose,
  onSettingChange,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  const [isReady, setIsReady] = useState(false)

  // Track double-tap outside for mobile close behavior
  const lastTouchOutsideRef = useRef<{ time: number; x: number; y: number } | null>(null)

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect()
      const padding = 10 // Padding from screen edges

      let newX = position.x
      let newY = position.y

      // Adjust horizontal position
      if (position.x + menuRect.width > window.innerWidth - padding) {
        newX = window.innerWidth - menuRect.width - padding
      }
      if (newX < padding) {
        newX = padding
      }

      // Adjust vertical position
      if (position.y + menuRect.height > window.innerHeight - padding) {
        newY = window.innerHeight - menuRect.height - padding
      }
      if (newY < padding) {
        newY = padding
      }

      setAdjustedPosition({ x: newX, y: newY })

      // Longer delay before allowing interactions to prevent double-tap second tap from triggering menu items
      setTimeout(() => setIsReady(true), 350)
    }
  }, [position])

  useEffect(() => {
    // Mouse click outside closes immediately (desktop behavior)
    const handleMouseClickOutside = (e: MouseEvent) => {
      if (!isReady) return

      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    // Touch outside requires double-tap to close (mobile behavior)
    const handleTouchOutside = (e: TouchEvent) => {
      if (!isReady) return

      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        const touch = e.touches[0]
        if (!touch) return

        const now = Date.now()
        const lastTouch = lastTouchOutsideRef.current

        // Check if this is a double-tap (within 400ms and 50px of last touch)
        if (lastTouch) {
          const timeDiff = now - lastTouch.time
          const distance = Math.sqrt(
            Math.pow(touch.clientX - lastTouch.x, 2) +
            Math.pow(touch.clientY - lastTouch.y, 2)
          )

          if (timeDiff < 400 && distance < 50) {
            // Double-tap detected - close the menu
            e.preventDefault()
            e.stopPropagation()
            lastTouchOutsideRef.current = null
            onClose()
            return
          }
        }

        // Record this touch for potential double-tap
        lastTouchOutsideRef.current = {
          time: now,
          x: touch.clientX,
          y: touch.clientY
        }

        // Prevent this single tap from doing anything else
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    // Use capture phase to ensure we get the event first
    // Separate handlers for mouse (single click) and touch (double tap)
    document.addEventListener('mousedown', handleMouseClickOutside, true)
    document.addEventListener('touchstart', handleTouchOutside, true)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('mousedown', handleMouseClickOutside, true)
      document.removeEventListener('touchstart', handleTouchOutside, true)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [onClose, isReady])

  const MenuItem = ({ label, onClick, destructive = false }: { label: string; onClick: () => void; destructive?: boolean }) => (
    <button
      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-accent active:bg-accent transition-colors ${destructive ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20' : 'text-foreground'}`}
      onClick={() => {
        if (!isReady) return
        onClick()
        onClose()
      }}
      onTouchEnd={(e) => {
        if (!isReady) return
        e.preventDefault()
        onClick()
        onClose()
      }}
    >
      {label}
    </button>
  )

  const Divider = () => <div className="border-t border-border my-0.5" />

  const SubMenuItem = ({ label, options }: { label: string; options: { label: string; value: any; current?: boolean }[] }) => (
    <div className="px-3 py-1.5">
      <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">{label}</div>
      <div className="flex flex-col gap-0.5">
        {options.map(option => (
          <button
            key={option.value}
            className={`text-left px-2 py-1.5 rounded text-sm ${option.current ? 'bg-primary text-primary-foreground' : 'hover:bg-accent active:bg-accent text-foreground'}`}
            onClick={() => {
              if (!isReady) return
              onSettingChange(node.id, label.toLowerCase().replace(/\s+/g, '_'), option.value)
              onClose()
            }}
            onTouchEnd={(e) => {
              if (!isReady) return
              e.preventDefault()
              onSettingChange(node.id, label.toLowerCase().replace(/\s+/g, '_'), option.value)
              onClose()
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )

  const ToggleMenuItem = ({ label, settingKey, currentValue }: { label: string; settingKey: string; currentValue: boolean }) => (
    <button
      className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent active:bg-accent transition-colors text-foreground flex items-center justify-between"
      onClick={() => {
        if (!isReady) return
        onSettingChange(node.id, settingKey, !currentValue)
        onClose()
      }}
      onTouchEnd={(e) => {
        if (!isReady) return
        e.preventDefault()
        onSettingChange(node.id, settingKey, !currentValue)
        onClose()
      }}
    >
      <span>{label}</span>
      <span className={`text-xs font-medium ${currentValue ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
        {currentValue ? 'ON' : 'OFF'}
      </span>
    </button>
  )

  return (
    <div
      ref={menuRef}
      className="fixed bg-background rounded-md shadow-lg border border-border z-[10000] min-w-[160px] max-w-[220px] py-1"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        touchAction: 'none' // Prevent any touch scrolling on the menu
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Node-specific settings */}
      {node.type === 'image' && (
        <>
          <ToggleMenuItem
            label="Show Header"
            settingKey="show_header"
            currentValue={node.settings?.show_header ?? true}
          />
          <ToggleMenuItem
            label="Show Caption"
            settingKey="show_caption"
            currentValue={node.settings?.show_caption ?? false}
          />
          <SubMenuItem
            label="Image Fit"
            options={[
              { label: 'Contain', value: 'contain', current: (node.settings?.image_fit ?? 'contain') === 'contain' },
              { label: 'Cover', value: 'cover', current: (node.settings?.image_fit ?? 'contain') === 'cover' },
              { label: 'Fill', value: 'fill', current: (node.settings?.image_fit ?? 'contain') === 'fill' }
            ]}
          />
          <Divider />
        </>
      )}

      {node.type === 'character' && (
        <>
          <ToggleMenuItem
            label="Show Profile Picture"
            settingKey="show_profile_picture"
            currentValue={node.settings?.show_profile_picture ?? true}
          />
          <SubMenuItem
            label="Picture Shape"
            options={[
              { label: 'Circle', value: 'circle', current: (node.settings?.picture_shape ?? 'rounded') === 'circle' },
              { label: 'Square', value: 'square', current: (node.settings?.picture_shape ?? 'rounded') === 'square' },
              { label: 'Rounded Square', value: 'rounded', current: (node.settings?.picture_shape ?? 'rounded') === 'rounded' }
            ]}
          />
          <Divider />
        </>
      )}

      {node.type === 'event' && (
        <>
          <ToggleMenuItem
            label="Show Duration Field"
            settingKey="show_duration"
            currentValue={node.settings?.show_duration ?? true}
          />
          <ToggleMenuItem
            label="Expand Summary"
            settingKey="expand_summary"
            currentValue={node.settings?.expand_summary ?? true}
          />
          <Divider />
        </>
      )}

      {node.type === 'folder' && (
        <>
          <ToggleMenuItem
            label="Expand by Default"
            settingKey="expand_by_default"
            currentValue={node.settings?.expand_by_default ?? true}
          />
          <Divider />
        </>
      )}


      {node.type === 'table' && (
        <>
          <ToggleMenuItem
            label="Show Header Row"
            settingKey="show_header_row"
            currentValue={node.settings?.show_header_row ?? true}
          />
          <ToggleMenuItem
            label="Alternate Row Colors"
            settingKey="alternate_row_colors"
            currentValue={node.settings?.alternate_row_colors ?? false}
          />
          <Divider />
        </>
      )}

      {/* Icon picker for all node types */}
      <IconPicker
        currentIcon={node.settings?.icon}
        nodeType={node.type}
        onSelect={(icon) => {
          onSettingChange(node.id, 'icon', icon)
          onClose()
        }}
        isReady={isReady}
      />
      <Divider />

      {/* Global settings for all nodes */}
      <MenuItem label="Duplicate" onClick={() => onDuplicate(node.id)} />
      <MenuItem label="Bring to Front" onClick={() => onBringToFront(node.id)} />
      <MenuItem label="Send to Back" onClick={() => onSendToBack(node.id)} />
      <Divider />
      <MenuItem label="Delete" onClick={() => onDelete(node.id)} destructive />
    </div>
  )
}
