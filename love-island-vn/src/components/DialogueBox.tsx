"use client";

import { CHARACTERS } from "@/data/characters";
import { useVNStore } from "@/engine/vnEngine";

interface DialogueBoxProps {
  characterId: string;
  text: string;
  expression?: string;
  onAdvance: () => void;
}

export function DialogueBox({
  characterId,
  text,
  expression,
  onAdvance,
}: DialogueBoxProps) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  const playerName = useVNStore((s) => s.gameState.playerName);

  const processedText = text.replace(/\{player\}/g, playerName);

  const displayName =
    characterId === "player" ? playerName : character?.name ?? "???";
  const nameColor = character?.color ?? "#f472b6";

  return (
    <div
      className="absolute bottom-0 left-0 right-0 cursor-pointer select-none"
      onClick={onAdvance}
    >
      <div className="mx-auto max-w-4xl p-4">
        <div className="relative bg-gradient-to-b from-black/80 to-black/90 backdrop-blur-md rounded-t-2xl border border-white/10 p-6 shadow-2xl min-h-[160px]">
          {/* Character name */}
          <div className="absolute -top-4 left-6">
            <span
              className="font-bold text-lg px-4 py-1 rounded-full shadow-lg"
              style={{
                color: nameColor,
                backgroundColor: "rgba(0,0,0,0.8)",
                border: `1px solid ${nameColor}40`,
              }}
            >
              {displayName}
            </span>
          </div>

          {/* Expression description */}
          {expression && (
            <p className="text-white/50 italic text-sm mb-2 mt-1">
              {expression}
            </p>
          )}

          {/* Dialogue text */}
          <p className="text-white text-lg leading-relaxed mt-2">
            {processedText}
          </p>

          {/* Click to continue indicator */}
          <div className="absolute bottom-2 right-4 text-white/40 text-sm animate-bounce">
            &#9660;
          </div>
        </div>
      </div>
    </div>
  );
}
