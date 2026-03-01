"use client";

import { useEffect, useRef } from "react";
import { useVNStore } from "@/engine/VNProvider";
import type { BacklogEntry } from "@/types";

export function Backlog() {
  const isOpen = useVNStore((s) => s.isBacklogOpen);
  const toggleBacklog = useVNStore((s) => s.toggleBacklog);
  const entries = useVNStore((s) => s.backlogEntries);
  const rewindTo = useVNStore((s) => s.rewindTo);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when opened
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRewind = (entry: BacklogEntry) => {
    if (entry.episodeId != null && entry.beatIndex != null) {
      rewindTo(entry.episodeId, entry.beatIndex);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={toggleBacklog}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl h-[80vh] mx-4 bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white/90">Backlog</h2>
            <p className="text-white/30 text-xs">Click any line to rewind</p>
          </div>
          <button
            onClick={toggleBacklog}
            className="text-white/50 hover:text-white text-2xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {entries.length === 0 && (
            <p className="text-white/30 text-center py-8">No history yet.</p>
          )}

          {entries.map((entry, i) => (
            <BacklogLine
              key={i}
              entry={entry}
              canRewind={entry.episodeId != null && entry.beatIndex != null}
              onRewind={() => handleRewind(entry)}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

function BacklogLine({
  entry,
  canRewind,
  onRewind,
}: {
  entry: BacklogEntry;
  canRewind: boolean;
  onRewind: () => void;
}) {
  const wrapperClass = canRewind
    ? "group cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
    : "px-2 py-1.5 -mx-2";

  if (entry.type === "transition") {
    return (
      <div className={wrapperClass} onClick={canRewind ? onRewind : undefined}>
        <div className="text-center py-1">
          <span className="text-white/30 text-sm uppercase tracking-widest">
            {entry.text}
          </span>
        </div>
      </div>
    );
  }

  if (entry.type === "dialogue") {
    return (
      <div className={wrapperClass} onClick={canRewind ? onRewind : undefined}>
        <div className="space-y-0.5">
          {entry.expression && (
            <p className="text-white/40 italic text-sm">{entry.expression}</p>
          )}
          <p className="text-white/90">
            <span
              className="font-bold mr-2"
              style={{ color: entry.characterColor ?? "#f472b6" }}
            >
              {entry.characterName}
            </span>
            {entry.text}
          </p>
        </div>
      </div>
    );
  }

  // narration or reaction
  const isItalic =
    entry.style === "emotion" ||
    entry.style === "thought" ||
    entry.style === "whisper";

  const colorClass =
    entry.type === "reaction"
      ? "text-pink-300"
      : entry.style === "emotion"
        ? "text-pink-300/80"
        : entry.style === "thought"
          ? "text-blue-200/70"
          : entry.style === "whisper"
            ? "text-white/40"
            : "text-white/70";

  return (
    <div className={wrapperClass} onClick={canRewind ? onRewind : undefined}>
      <p className={`${colorClass} ${isItalic ? "italic" : ""} text-sm`}>
        {entry.text}
      </p>
    </div>
  );
}
