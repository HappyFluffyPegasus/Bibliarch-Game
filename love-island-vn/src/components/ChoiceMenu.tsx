"use client";

import { useEffect } from "react";
import type { ChoiceBeat } from "@/types";

interface ChoiceMenuProps {
  beat: ChoiceBeat;
  onChoose: (index: number) => void;
  visitedIndices?: number[];
  onFinish?: () => void;
}

export function ChoiceMenu({
  beat,
  onChoose,
  visitedIndices = [],
  onFinish,
}: ChoiceMenuProps) {
  // For repeatable choices, filter out already-visited options
  const availableChoices = beat.choices
    .map((choice, i) => ({ choice, originalIndex: i }))
    .filter(({ originalIndex }) => !visitedIndices.includes(originalIndex));

  const allVisited = beat.repeatable && availableChoices.length === 0;

  // Auto-finish when all options exhausted (must be in an effect, not during render)
  useEffect(() => {
    if (allVisited && onFinish) {
      onFinish();
    }
  }, [allVisited, onFinish]);

  if (allVisited) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
      <div className="max-w-xl w-full mx-4 space-y-3">
        {/* Prompt */}
        <p className="text-center text-white/80 text-lg font-medium mb-6 drop-shadow-lg">
          {beat.prompt}
        </p>

        {/* Choice buttons */}
        {availableChoices.map(({ choice, originalIndex }) => (
          <button
            key={originalIndex}
            onClick={() => onChoose(originalIndex)}
            className="w-full px-6 py-4 text-left text-white text-lg
              bg-gradient-to-r from-pink-600/70 to-rose-500/70
              hover:from-pink-500 hover:to-rose-400
              backdrop-blur-md rounded-xl border border-white/20
              transition-all duration-200 hover:scale-[1.02] hover:shadow-xl
              active:scale-[0.98]"
          >
            {choice.text}
          </button>
        ))}

        {/* Finish button for repeatable choices */}
        {beat.repeatable && onFinish && (
          <button
            onClick={onFinish}
            className="w-full px-6 py-4 text-center text-white/70 text-lg
              bg-white/10 hover:bg-white/20
              backdrop-blur-md rounded-xl border border-white/10 hover:border-white/20
              transition-all duration-200 hover:scale-[1.02]
              active:scale-[0.98]"
          >
            {beat.finishText ?? "I'm finished for the day."}
          </button>
        )}
      </div>
    </div>
  );
}
