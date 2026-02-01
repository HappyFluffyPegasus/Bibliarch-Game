"use client";

import { useState } from "react";
import { useVNStore } from "@/engine/vnEngine";
import { CHARACTERS } from "@/data/characters";

export function RelationshipHUD() {
  const [isOpen, setIsOpen] = useState(false);
  const relationships = useVNStore((s) => s.gameState.relationships);

  const sortedChars = CHARACTERS.filter((c) => c.id !== "player").sort(
    (a, b) =>
      (relationships[b.id]?.score ?? 0) - (relationships[a.id]?.score ?? 0)
  );

  const getHeartLevel = (score: number) => {
    if (score >= 50) return { emoji: "\u2764\uFE0F", label: "Soulmate" };
    if (score >= 30) return { emoji: "\uD83E\uDDE1", label: "Strong Connection" };
    if (score >= 15) return { emoji: "\uD83D\uDC9B", label: "Getting Closer" };
    if (score >= 5) return { emoji: "\uD83D\uDC9A", label: "Friendly" };
    if (score >= 0) return { emoji: "\uD83E\uDE76", label: "Just Met" };
    return { emoji: "\uD83D\uDC94", label: "Icy" };
  };

  return (
    <div className="absolute top-4 right-4 z-30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full
          border border-pink-500/30 hover:border-pink-500/60 transition-all
          text-sm font-medium"
      >
        {isOpen ? "Close" : "Relationships"}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-72 bg-black/85 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-2xl animate-fade-in">
          <h3 className="text-pink-400 font-bold text-sm uppercase tracking-wider mb-3">
            Relationship Status
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {sortedChars.map((char) => {
              const rel = relationships[char.id];
              const score = rel?.score ?? 0;
              const { emoji, label } = getHeartLevel(score);
              const barWidth = Math.min(Math.max((score + 10) / 60, 0.05), 1) * 100;

              return (
                <div key={char.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: char.color }} className="font-medium">
                      {char.name}
                    </span>
                    <span className="text-white/50 text-xs">
                      {emoji} {label}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
