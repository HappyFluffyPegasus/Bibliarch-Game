import { create } from "zustand";
import type {
  GameState,
  Episode,
  Relationship,
  SceneBeat,
  ChoiceBeat,
  BacklogEntry,
  SaveData,
  SaveSlot,
} from "@/types";
import { EPISODES } from "@/data/episodes";
import { CHARACTERS } from "@/data/characters";

const SAVE_KEY_PREFIX = "love-island-vn-save-";
const SAVE_SLOT_COUNT = 6;

interface VNStore {
  // ---------- State ----------
  gameState: GameState;
  isStarted: boolean;
  choiceReaction: string | null;
  choiceReactionCharacterId: string | null;
  visitedChoiceIndices: number[];
  isTyping: boolean;
  backlogEntries: BacklogEntry[];
  isBacklogOpen: boolean;
  isSaveMenuOpen: boolean;
  isLoadMenuOpen: boolean;

  // ---------- Derived ----------
  currentEpisode: () => Episode | undefined;
  currentBeat: () => SceneBeat | undefined;

  // ---------- Actions ----------
  startGame: (playerName: string) => void;
  advance: () => void;
  makeChoice: (choiceIndex: number) => void;
  clearReaction: () => void;
  finishRepeatableChoice: () => void;
  setTyping: (val: boolean) => void;
  getRelationship: (characterId: string) => Relationship;
  resetGame: () => void;

  // ---------- Backlog ----------
  toggleBacklog: () => void;
  rewindTo: (episodeId: string, beatIndex: number) => void;

  // ---------- Save / Load ----------
  toggleSaveMenu: () => void;
  toggleLoadMenu: () => void;
  saveGame: (slot: number) => void;
  loadGame: (slot: number) => void;
  deleteSave: (slot: number) => void;
  getSaveSlots: () => SaveSlot[];
}

/** Convert the current beat into a backlog entry */
function beatToBacklogEntry(
  beat: SceneBeat,
  episodeTitle: string,
  episodeId: string,
  beatIndex: number
): BacklogEntry | null {
  switch (beat.type) {
    case "dialogue": {
      const char = CHARACTERS.find((c) => c.id === beat.characterId);
      return {
        episodeTitle,
        episodeId,
        beatIndex,
        characterName: char?.name ?? beat.characterId,
        characterColor: char?.color,
        text: beat.text,
        expression: beat.expression,
        type: "dialogue",
      };
    }
    case "narration":
      return {
        episodeTitle,
        episodeId,
        beatIndex,
        text: beat.text,
        style: beat.style,
        type: "narration",
      };
    case "transition":
      return {
        episodeTitle,
        episodeId,
        beatIndex,
        text: beat.text,
        type: "transition",
      };
    case "choice":
      // Choices themselves aren't logged; the reaction is logged separately
      return null;
  }
}

const initialGameState: GameState = {
  currentEpisodeId: "ep1",
  currentBeatIndex: 0,
  relationships: Object.fromEntries(
    CHARACTERS.map((c) => [
      c.id,
      { characterId: c.id, score: 0, flags: [] } as Relationship,
    ])
  ),
  choicesMade: {},
  playerName: "You",
  couples: [],
};

export const useVNStore = create<VNStore>((set, get) => ({
  gameState: { ...initialGameState },
  isStarted: false,
  choiceReaction: null,
  choiceReactionCharacterId: null,
  visitedChoiceIndices: [],
  isTyping: false,
  backlogEntries: [],
  isBacklogOpen: false,
  isSaveMenuOpen: false,
  isLoadMenuOpen: false,

  currentEpisode: () =>
    EPISODES.find((ep) => ep.id === get().gameState.currentEpisodeId),

  currentBeat: () => {
    const ep = get().currentEpisode();
    if (!ep) return undefined;
    return ep.beats[get().gameState.currentBeatIndex];
  },

  startGame: (playerName: string) =>
    set({
      isStarted: true,
      backlogEntries: [],
      visitedChoiceIndices: [],
      choiceReactionCharacterId: null,
      gameState: {
        ...initialGameState,
        playerName,
        relationships: { ...initialGameState.relationships },
        choicesMade: {},
      },
    }),

  advance: () => {
    const { gameState, currentEpisode, currentBeat, backlogEntries } = get();
    const ep = currentEpisode();
    if (!ep) return;

    // Record current beat to backlog before advancing
    const beat = currentBeat();
    if (beat) {
      const entry = beatToBacklogEntry(beat, ep.title, ep.id, gameState.currentBeatIndex);
      if (entry) {
        set({ backlogEntries: [...backlogEntries, entry] });
      }
    }

    const nextIndex = gameState.currentBeatIndex + 1;

    if (nextIndex >= ep.beats.length) {
      const currentIdx = EPISODES.findIndex((e) => e.id === ep.id);
      const nextEp = EPISODES[currentIdx + 1];
      if (nextEp) {
        set((state) => ({
          gameState: {
            ...state.gameState,
            currentEpisodeId: nextEp.id,
            currentBeatIndex: 0,
          },
        }));
      }
      return;
    }

    set((state) => ({
      gameState: {
        ...state.gameState,
        currentBeatIndex: nextIndex,
      },
      choiceReaction: null,
    }));
  },

  makeChoice: (choiceIndex: number) => {
    const { gameState, currentEpisode, visitedChoiceIndices } = get();
    const ep = currentEpisode();
    if (!ep) return;

    const beat = ep.beats[gameState.currentBeatIndex];
    if (beat.type !== "choice") return;

    const choiceBeat = beat as ChoiceBeat;
    const chosen = choiceBeat.choices[choiceIndex];
    if (!chosen) return;

    // Apply relationship changes
    const newRelationships = { ...gameState.relationships };
    if (chosen.relationshipChanges) {
      for (const [charId, delta] of Object.entries(
        chosen.relationshipChanges
      )) {
        if (newRelationships[charId]) {
          newRelationships[charId] = {
            ...newRelationships[charId],
            score: newRelationships[charId].score + delta,
          };
        }
      }
    }

    // Record choice
    const newChoices = { ...gameState.choicesMade };
    if (!newChoices[ep.id]) newChoices[ep.id] = {};
    newChoices[ep.id][gameState.currentBeatIndex] = choiceIndex;

    const nextBeatIndex = chosen.jumpTo ?? gameState.currentBeatIndex;

    set((state) => ({
      gameState: {
        ...state.gameState,
        relationships: newRelationships,
        choicesMade: newChoices,
        currentBeatIndex:
          chosen.jumpTo != null ? nextBeatIndex : state.gameState.currentBeatIndex,
      },
      choiceReaction: chosen.reaction || null,
      choiceReactionCharacterId: chosen.characterId || null,
      visitedChoiceIndices: choiceBeat.repeatable
        ? [...visitedChoiceIndices, choiceIndex]
        : visitedChoiceIndices,
    }));
  },

  clearReaction: () => {
    const { choiceReaction, currentEpisode, currentBeat, backlogEntries } = get();
    const ep = currentEpisode();
    const beat = currentBeat();

    // Log the reaction to backlog before clearing
    if (choiceReaction && ep) {
      set({
        backlogEntries: [
          ...backlogEntries,
          {
            episodeTitle: ep.title,
            text: choiceReaction,
            style: "emotion",
            type: "reaction",
          },
        ],
      });
    }

    set({ choiceReaction: null, choiceReactionCharacterId: null });

    // For repeatable choices, stay on the same beat (don't advance)
    if (beat?.type === "choice" && (beat as ChoiceBeat).repeatable) {
      return;
    }

    get().advance();
  },

  finishRepeatableChoice: () => {
    set({ visitedChoiceIndices: [] });
    get().advance();
  },

  setTyping: (val: boolean) => set({ isTyping: val }),

  getRelationship: (characterId: string) => {
    const rel = get().gameState.relationships[characterId];
    return rel || { characterId, score: 0, flags: [] };
  },

  resetGame: () =>
    set({
      isStarted: false,
      gameState: { ...initialGameState },
      choiceReaction: null,
      choiceReactionCharacterId: null,
      visitedChoiceIndices: [],
      backlogEntries: [],
    }),

  // ---------- Backlog ----------
  toggleBacklog: () => set((s) => ({ isBacklogOpen: !s.isBacklogOpen })),

  rewindTo: (episodeId: string, beatIndex: number) => {
    const { backlogEntries } = get();

    // Find the entry in the backlog and truncate everything from that point on
    const entryIdx = backlogEntries.findIndex(
      (e) => e.episodeId === episodeId && e.beatIndex === beatIndex
    );
    const truncatedBacklog =
      entryIdx >= 0 ? backlogEntries.slice(0, entryIdx) : backlogEntries;

    set((state) => ({
      gameState: {
        ...state.gameState,
        currentEpisodeId: episodeId,
        currentBeatIndex: beatIndex,
      },
      backlogEntries: truncatedBacklog,
      choiceReaction: null,
      isBacklogOpen: false,
    }));
  },

  // ---------- Save / Load ----------
  toggleSaveMenu: () =>
    set((s) => ({ isSaveMenuOpen: !s.isSaveMenuOpen, isLoadMenuOpen: false })),

  toggleLoadMenu: () =>
    set((s) => ({ isLoadMenuOpen: !s.isLoadMenuOpen, isSaveMenuOpen: false })),

  saveGame: (slot: number) => {
    const { gameState, backlogEntries, currentEpisode } = get();
    const ep = currentEpisode();
    const data: SaveData = {
      gameState,
      backlog: backlogEntries,
      timestamp: Date.now(),
      episodeTitle: ep?.title ?? "Unknown",
      playerName: gameState.playerName,
    };
    try {
      localStorage.setItem(
        `${SAVE_KEY_PREFIX}${slot}`,
        JSON.stringify(data)
      );
    } catch {
      // localStorage full or unavailable — silent fail
    }
  },

  loadGame: (slot: number) => {
    try {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${slot}`);
      if (!raw) return;
      const data: SaveData = JSON.parse(raw);
      set({
        gameState: data.gameState,
        backlogEntries: data.backlog ?? [],
        isStarted: true,
        choiceReaction: null,
        isSaveMenuOpen: false,
        isLoadMenuOpen: false,
      });
    } catch {
      // corrupted data — silent fail
    }
  },

  deleteSave: (slot: number) => {
    try {
      localStorage.removeItem(`${SAVE_KEY_PREFIX}${slot}`);
    } catch {
      // silent fail
    }
  },

  getSaveSlots: (): SaveSlot[] => {
    const slots: SaveSlot[] = [];
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      try {
        const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${i}`);
        slots.push({
          slot: i,
          data: raw ? JSON.parse(raw) : null,
        });
      } catch {
        slots.push({ slot: i, data: null });
      }
    }
    return slots;
  },
}));
