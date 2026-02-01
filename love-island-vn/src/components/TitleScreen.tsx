"use client";

import { useEffect, useState } from "react";
import { useVNStore } from "@/engine/vnEngine";

export function TitleScreen() {
  const [playerName, setPlayerName] = useState("");
  const [showLoad, setShowLoad] = useState(false);
  const startGame = useVNStore((s) => s.startGame);
  const toggleLoadMenu = useVNStore((s) => s.toggleLoadMenu);

  useEffect(() => {
    try {
      for (let i = 1; i <= 6; i++) {
        if (localStorage.getItem(`love-island-vn-save-${i}`)) {
          setShowLoad(true);
          return;
        }
      }
    } catch {}
  }, []);

  const handleStart = () => {
    if (playerName.trim()) {
      startGame(playerName.trim());
    }
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-b from-pink-900 via-rose-950 to-black relative overflow-hidden">
      {/* Animated background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center space-y-8">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-pink-400 via-rose-300 to-amber-300 bg-clip-text text-transparent drop-shadow-2xl">
            LOVE ISLAND
          </h1>
          <p className="text-xl md:text-2xl text-pink-200/60 tracking-[0.3em] uppercase font-light">
            The Crossover
          </p>
          <p className="text-sm text-white/30 mt-4">
            All your characters. One villa. Infinite drama.
          </p>
        </div>

        {/* Name input */}
        <div className="space-y-4">
          <p className="text-pink-200/70 text-lg">What&apos;s your name, islander?</p>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="Enter your name..."
            className="w-72 px-6 py-3 bg-white/10 backdrop-blur-sm border border-pink-500/30
              rounded-xl text-white text-center text-lg placeholder-white/30
              focus:outline-none focus:border-pink-400 focus:bg-white/15
              transition-all"
            maxLength={20}
          />
          <div>
            <button
              onClick={handleStart}
              disabled={!playerName.trim()}
              className="px-10 py-4 bg-gradient-to-r from-pink-600 to-rose-500
                hover:from-pink-500 hover:to-rose-400
                disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed
                text-white font-bold text-lg rounded-xl
                transition-all duration-200 hover:scale-105 active:scale-95
                shadow-lg shadow-pink-500/25"
            >
              Step into the Villa
            </button>
            {showLoad && (
              <button
                onClick={toggleLoadMenu}
                className="ml-4 px-6 py-4 bg-white/10 hover:bg-white/20
                  text-white/70 hover:text-white font-medium text-lg rounded-xl
                  border border-white/10 hover:border-white/20
                  transition-all duration-200"
              >
                Load Game
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
