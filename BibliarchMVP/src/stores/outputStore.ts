import { create } from 'zustand'

export type LogLevel = 'info' | 'warning' | 'error'

export interface LogEntry {
  id: number
  level: LogLevel
  message: string
  timestamp: Date
}

interface OutputState {
  entries: LogEntry[]
  nextId: number
  filter: LogLevel | 'all'

  log: (level: LogLevel, message: string) => void
  clear: () => void
  setFilter: (filter: LogLevel | 'all') => void
}

export const useOutputStore = create<OutputState>()((set) => ({
  entries: [],
  nextId: 1,
  filter: 'all',

  log: (level, message) =>
    set((s) => ({
      entries: [...s.entries.slice(-500), { id: s.nextId, level, message, timestamp: new Date() }],
      nextId: s.nextId + 1,
    })),

  clear: () => set({ entries: [] }),
  setFilter: (filter) => set({ filter }),
}))
