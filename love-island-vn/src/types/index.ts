// ============================================
// VN Library - Core Type Definitions
// ============================================

/** Configuration for a single visual novel in the library */
export interface VNConfig {
  id: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  coverImage: string;
  startEpisodeId: string;
  episodes: Episode[];
  characters: Character[];
  theme?: VNTheme;
  titleScreen?: TitleScreenConfig;
}

export interface VNTheme {
  accentColor?: string;
  accentColorSecondary?: string;
  titleGradient?: string;
}

export interface TitleScreenConfig {
  namePrompt?: string;
  startButtonText?: string;
  backgroundClasses?: string;
}

/** Character definition - add your characters here */
export interface Character {
  id: string;
  name: string;
  /** Which story they originally come from */
  sourceStory: string;
  /** Default sprite filename in public/sprites/ (e.g. "Ellie Base.png") */
  sprite: string;
  /**
   * Optional map of expression variants to sprite filenames.
   * e.g. { flustered: "Ellie Flustered.png", happy: "Ellie Happy.png" }
   * Characters without variants just use the base `sprite` field.
   */
  sprites?: Record<string, string>;
  /** Short bio/personality summary */
  bio: string;
  /** Default text color for their dialogue */
  color: string;
}

/**
 * Narration descriptor - since each character only has 1 sprite,
 * we use narration text to convey expressions, gestures, and emotions.
 * These appear as italic text above or below the character sprite.
 */
export type NarrationStyle = "action" | "emotion" | "thought" | "whisper";

/** A single beat in a scene - can be dialogue, narration, or a choice */
export type SceneBeat =
  | DialogueBeat
  | NarrationBeat
  | ChoiceBeat
  | TransitionBeat;

/** Character speaks with optional expression narration */
export interface DialogueBeat {
  type: "dialogue";
  characterId: string;
  text: string;
  /**
   * Expression narration shown with the dialogue.
   * e.g. "*blushing furiously*" or "*looking away nervously*"
   * Used for characters without sprite variants, or for extra detail.
   */
  expression?: string;
  /**
   * Which sprite variant to show for the speaking character.
   * Must match a key in the character's `sprites` map (e.g. "flustered", "happy").
   * Falls back to the base sprite if not specified or if character has no variants.
   */
  spriteVariant?: string;
  /** Sprite variants for other on-screen characters: { characterId: variantName } */
  onScreenVariants?: Record<string, string>;
  /** Which characters are visible on screen */
  onScreen?: string[];
}

/** Pure narration / scene description */
export interface NarrationBeat {
  type: "narration";
  text: string;
  style?: NarrationStyle;
  /** Optional: which character this narration focuses on */
  focusCharacter?: string;
  /** Characters to show on screen during this narration (overrides backward scan) */
  onScreen?: string[];
}

/** Player choice that can affect relationships and branch the story */
export interface ChoiceBeat {
  type: "choice";
  prompt: string;
  choices: Choice[];
  /** Characters to show on screen behind the choice overlay */
  onScreen?: string[];
  /** If true, the choice repeats after each reaction (visited options hidden). Shows a finish button. */
  repeatable?: boolean;
  /** Text for the finish button on repeatable choices */
  finishText?: string;
}

/** Scene transition */
export interface TransitionBeat {
  type: "transition";
  text: string;
  /** Background to switch to */
  background?: string;
  /** Change the scene mood/lighting */
  mood?: string;
}

export interface Choice {
  text: string;
  /** Relationship changes from this choice: { characterId: delta } */
  relationshipChanges?: Record<string, number>;
  /** Which scene beat index to jump to (if branching) */
  jumpTo?: number;
  /** Optional narration that plays after choosing */
  reaction?: string;
  /** Optional character to preview next to this choice */
  characterId?: string;
}

/** A full scene/episode */
export interface Episode {
  id: string;
  title: string;
  /** Episode subtitle (e.g. "Day 1 - First Impressions") */
  subtitle?: string;
  /** Background image path */
  background: string;
  /** Default mood/lighting for gradient tinting (e.g. "golden-hour", "night") */
  mood?: string;
  beats: SceneBeat[];
}

/** Relationship between player and a character */
export interface Relationship {
  characterId: string;
  score: number;
  /** Milestones reached */
  flags: string[];
}

/** Full game save state */
export interface GameState {
  currentEpisodeId: string;
  currentBeatIndex: number;
  relationships: Record<string, Relationship>;
  /** Choices the player has made: episodeId -> choiceIndex -> choiceOptionIndex */
  choicesMade: Record<string, Record<number, number>>;
  /** Player's chosen name */
  playerName: string;
  /** Which characters are currently coupled up */
  couples: [string, string][];
}

/** A single entry in the backlog history */
export interface BacklogEntry {
  episodeTitle: string;
  /** Episode ID for rewind */
  episodeId?: string;
  /** Beat index for rewind */
  beatIndex?: number;
  characterName?: string;
  characterColor?: string;
  text: string;
  expression?: string;
  style?: NarrationStyle;
  type: "dialogue" | "narration" | "transition" | "reaction";
}

/** Data stored in a single save slot */
export interface SaveData {
  gameState: GameState;
  backlog: BacklogEntry[];
  timestamp: number;
  episodeTitle: string;
  playerName: string;
}

/** Summary of a save slot for display */
export interface SaveSlot {
  slot: number;
  data: SaveData | null;
}
