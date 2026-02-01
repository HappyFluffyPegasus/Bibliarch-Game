"use client";

import { useState } from "react";
import { useVNStore } from "@/engine/vnEngine";
import { CharacterSprite } from "./CharacterSprite";
import { DialogueBox } from "./DialogueBox";
import { ChoiceMenu } from "./ChoiceMenu";
import { RelationshipHUD } from "./RelationshipHUD";
import { Backlog } from "./Backlog";
import { CHARACTERS } from "@/data/characters";
import type { ChoiceBeat, DialogueBeat, Episode, NarrationStyle, SceneBeat } from "@/types";

/** Determine sprite positions based on how many characters are on screen */
function getPositions(
  characterIds: string[]
): Array<"left" | "center" | "right"> {
  if (characterIds.length === 1) return ["center"];
  if (characterIds.length === 2) return ["left", "right"];
  return ["left", "center", "right"];
}

/**
 * Find which characters should be visible for the current beat.
 * For dialogue/narration beats with explicit onScreen, use that.
 * For narration with focusCharacter, show that character.
 * Otherwise, scan backwards to persist the last visible characters.
 * Transitions always clear the screen (scene change).
 */
function getVisibleCharacters(episode: Episode, beatIndex: number): string[] {
  const beat = episode.beats[beatIndex];

  // Dialogue beats: use explicit onScreen
  if (beat.type === "dialogue" && beat.onScreen) {
    return beat.onScreen;
  }

  // Narration beats: explicit onScreen > focusCharacter > backward scan
  if (beat.type === "narration") {
    if (beat.onScreen) return beat.onScreen;
    if (beat.focusCharacter) return [beat.focusCharacter];
  }

  // Choice beats: explicit onScreen > backward scan
  if (beat.type === "choice" && (beat as ChoiceBeat).onScreen) {
    return (beat as ChoiceBeat).onScreen!;
  }

  // Transitions clear characters
  if (beat.type === "transition") return [];

  // Backward scan: find the last beat with visible characters
  for (let i = beatIndex - 1; i >= 0; i--) {
    const prev = episode.beats[i];
    if (prev.type === "transition") return [];
    if (prev.type === "dialogue" && prev.onScreen) return prev.onScreen;
    if (prev.type === "narration") {
      if (prev.onScreen) return prev.onScreen;
      if (prev.focusCharacter) return [prev.focusCharacter];
    }
  }

  return [];
}

/** Get the active background, accounting for mid-episode transition changes */
function getActiveBackground(episode: Episode, beatIndex: number): string {
  for (let i = beatIndex; i >= 0; i--) {
    const beat = episode.beats[i];
    if (beat.type === "transition" && beat.background) {
      return beat.background;
    }
  }
  return episode.background;
}

/** Get the current scene mood by scanning backwards for the latest mood change */
function getSceneMood(
  episode: Episode,
  beatIndex: number
): string | undefined {
  for (let i = beatIndex; i >= 0; i--) {
    const beat = episode.beats[i];
    if (beat.type === "transition" && beat.mood) {
      return beat.mood;
    }
  }
  return episode.mood;
}

/** Map mood string to gradient overlay CSS classes */
function getMoodGradient(mood?: string): string {
  switch (mood) {
    case "golden-hour":
      return "bg-gradient-to-b from-sky-500/10 via-amber-500/15 to-orange-500/20";
    case "night":
      return "bg-gradient-to-b from-indigo-950/35 via-blue-950/20 to-purple-950/15";
    case "romantic":
      return "bg-gradient-to-b from-pink-900/20 via-purple-900/15 to-indigo-950/20";
    default:
      return "";
  }
}

export function VNScene() {
  const currentEpisode = useVNStore((s) => s.currentEpisode());
  const currentBeat = useVNStore((s) => s.currentBeat());
  const beatIndex = useVNStore((s) => s.gameState.currentBeatIndex);
  const choiceReaction = useVNStore((s) => s.choiceReaction);
  const choiceReactionCharacterId = useVNStore((s) => s.choiceReactionCharacterId);
  const visitedChoiceIndices = useVNStore((s) => s.visitedChoiceIndices);
  const advance = useVNStore((s) => s.advance);
  const makeChoice = useVNStore((s) => s.makeChoice);
  const clearReaction = useVNStore((s) => s.clearReaction);
  const finishRepeatableChoice = useVNStore((s) => s.finishRepeatableChoice);
  const toggleBacklog = useVNStore((s) => s.toggleBacklog);
  const toggleSaveMenu = useVNStore((s) => s.toggleSaveMenu);
  const toggleLoadMenu = useVNStore((s) => s.toggleLoadMenu);
  const resetGame = useVNStore((s) => s.resetGame);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  if (!currentEpisode || !currentBeat) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-b from-pink-900 to-black">
        <div className="text-center animate-fade-in">
          <p className="text-3xl text-pink-300 font-bold mb-2">
            End of available episodes
          </p>
          <p className="text-white/50">More drama coming soon...</p>
          <button
            onClick={() => useVNStore.getState().resetGame()}
            className="mt-6 px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  const visibleCharacters = getVisibleCharacters(currentEpisode, beatIndex);
  const activeBackground = getActiveBackground(currentEpisode, beatIndex);
  const mood = getSceneMood(currentEpisode, beatIndex);

  // Show choice reaction with the chosen character visible
  if (choiceReaction) {
    const reactionCharacters = choiceReactionCharacterId
      ? [choiceReactionCharacterId]
      : visibleCharacters;

    return (
      <div className="relative w-full h-screen overflow-hidden">
        <SceneBackground background={activeBackground} mood={mood} />
        {reactionCharacters.length > 0 && (
          <SceneCharacters
            characterIds={reactionCharacters}
            currentBeat={currentBeat}
          />
        )}
        <NarrationBox
          text={choiceReaction}
          style="emotion"
          onAdvance={clearReaction}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background with mood gradient */}
      <SceneBackground background={activeBackground} mood={mood} />

      {/* Episode title overlay (shown on first beat) */}
      {beatIndex === 0 && currentBeat.type !== "transition" && (
        <div className="absolute top-8 left-0 right-0 text-center z-10 animate-fade-in pointer-events-none">
          <h2 className="text-2xl text-pink-300 font-bold drop-shadow-lg">
            {currentEpisode.title}
          </h2>
          {currentEpisode.subtitle && (
            <p className="text-white/50 text-sm mt-1">
              {currentEpisode.subtitle}
            </p>
          )}
        </div>
      )}

      {/* Relationship HUD */}
      <RelationshipHUD />

      {/* Game menu buttons */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <HudButton label="Home" onClick={() => setShowQuitConfirm(true)} />
        <HudButton label="Log" onClick={toggleBacklog} />
        <HudButton label="Save" onClick={toggleSaveMenu} />
        <HudButton label="Load" onClick={toggleLoadMenu} />
      </div>

      {/* Quit confirmation dialog */}
      {showQuitConfirm && (
        <QuitConfirmDialog
          onSaveFirst={() => {
            setShowQuitConfirm(false);
            toggleSaveMenu();
          }}
          onLeave={() => {
            setShowQuitConfirm(false);
            resetGame();
          }}
          onCancel={() => setShowQuitConfirm(false)}
        />
      )}

      {/* Backlog overlay */}
      <Backlog />

      {/* Character sprites - persist across all beat types */}
      {visibleCharacters.length > 0 && (
        <SceneCharacters
          characterIds={visibleCharacters}
          currentBeat={currentBeat}
        />
      )}

      {/* Render based on beat type */}
      {currentBeat.type === "dialogue" && (
        <DialogueBox
          characterId={currentBeat.characterId}
          text={currentBeat.text}
          expression={currentBeat.expression}
          onAdvance={advance}
        />
      )}

      {currentBeat.type === "narration" && (
        <NarrationBox
          text={currentBeat.text}
          style={currentBeat.style}
          onAdvance={advance}
        />
      )}

      {currentBeat.type === "choice" && (
        <ChoiceMenu
          beat={currentBeat}
          onChoose={makeChoice}
          visitedIndices={visitedChoiceIndices}
          onFinish={finishRepeatableChoice}
        />
      )}

      {currentBeat.type === "transition" && (
        <NarrationBox
          text={currentBeat.text}
          style="action"
          onAdvance={advance}
        />
      )}
    </div>
  );
}

/** Renders character sprites for any beat type */
function SceneCharacters({
  characterIds,
  currentBeat,
}: {
  characterIds: string[];
  currentBeat: SceneBeat;
}) {
  const positions = getPositions(characterIds);

  return (
    <>
      {characterIds.map((charId, i) => {
        const char = CHARACTERS.find((c) => c.id === charId);
        if (!char) return null;

        const isSpeaking =
          currentBeat.type === "dialogue" &&
          charId === (currentBeat as DialogueBeat).characterId;

        let variant: string | undefined;
        if (currentBeat.type === "dialogue") {
          const db = currentBeat as DialogueBeat;
          variant =
            charId === db.characterId
              ? db.spriteVariant
              : db.onScreenVariants?.[charId];
        }

        const expression =
          currentBeat.type === "dialogue" &&
          charId === (currentBeat as DialogueBeat).characterId
            ? (currentBeat as DialogueBeat).expression
            : undefined;

        return (
          <CharacterSprite
            key={charId}
            characterId={charId}
            position={positions[i]}
            isSpeaking={isSpeaking}
            spriteVariant={variant}
            expression={expression}
          />
        );
      })}
    </>
  );
}

function SceneBackground({
  background,
  mood,
}: {
  background: string;
  mood?: string;
}) {
  const moodGradient = getMoodGradient(mood);

  return (
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{
        backgroundImage: `url(${background})`,
        backgroundColor: "#1a0a2e",
      }}
    >
      {/* Mood tint overlay */}
      {moodGradient && (
        <div
          className={`absolute inset-0 transition-all duration-1000 ${moodGradient}`}
        />
      )}
      {/* Dark gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
    </div>
  );
}

const narrationColors: Record<NarrationStyle, string> = {
  action: "text-white/90",
  emotion: "text-pink-300",
  thought: "text-blue-200/80",
  whisper: "text-white/50",
};

function NarrationBox({
  text,
  style = "action",
  onAdvance,
}: {
  text: string;
  style?: NarrationStyle;
  onAdvance: () => void;
}) {
  const playerName = useVNStore((s) => s.gameState.playerName);
  const processedText = text.replace(/\{player\}/g, playerName);

  const isItalic =
    style === "emotion" || style === "thought" || style === "whisper";

  return (
    <div
      className="absolute bottom-0 left-0 right-0 cursor-pointer select-none"
      onClick={onAdvance}
    >
      <div className="mx-auto max-w-4xl p-4">
        <div className="relative bg-gradient-to-b from-black/80 to-black/90 backdrop-blur-md rounded-t-2xl border border-white/10 p-6 shadow-2xl min-h-[160px]">
          <p
            className={`${narrationColors[style]} ${isItalic ? "italic" : ""} text-lg leading-relaxed`}
          >
            {processedText}
          </p>
          <div className="absolute bottom-2 right-4 text-white/40 text-sm animate-bounce">
            &#9660;
          </div>
        </div>
      </div>
    </div>
  );
}

function QuitConfirmDialog({
  onSaveFirst,
  onLeave,
  onCancel,
}: {
  onSaveFirst: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-white/10 shadow-2xl p-6 max-w-sm mx-4 w-full">
        <p className="text-white/90 text-lg font-medium text-center mb-6">
          Save before leaving?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onSaveFirst}
            className="w-full px-4 py-3 text-white text-sm font-medium bg-pink-600 hover:bg-pink-500 rounded-xl transition-colors"
          >
            Save First
          </button>
          <button
            onClick={onLeave}
            className="w-full px-4 py-3 text-white/70 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
          >
            Leave Without Saving
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-3 text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function HudButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 hover:border-white/20 transition-all"
    >
      {label}
    </button>
  );
}
