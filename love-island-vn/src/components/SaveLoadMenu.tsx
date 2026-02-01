"use client";

import { useState } from "react";
import { useVNStore } from "@/engine/vnEngine";

export function SaveLoadMenu() {
  const isSaveOpen = useVNStore((s) => s.isSaveMenuOpen);
  const isLoadOpen = useVNStore((s) => s.isLoadMenuOpen);
  const toggleSave = useVNStore((s) => s.toggleSaveMenu);
  const toggleLoad = useVNStore((s) => s.toggleLoadMenu);
  const saveGame = useVNStore((s) => s.saveGame);
  const loadGame = useVNStore((s) => s.loadGame);
  const deleteSave = useVNStore((s) => s.deleteSave);
  const getSaveSlots = useVNStore((s) => s.getSaveSlots);

  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isOpen = isSaveOpen || isLoadOpen;
  const mode = isSaveOpen ? "save" : "load";

  if (!isOpen) return null;

  const slots = getSaveSlots();
  const close = mode === "save" ? toggleSave : toggleLoad;

  const handleSlotClick = (slot: number, hasData: boolean) => {
    if (mode === "save") {
      if (hasData) {
        // Ask for overwrite confirmation
        setConfirmSlot(slot);
      } else {
        saveGame(slot);
        setRefreshKey((k) => k + 1);
      }
    } else {
      // Load mode
      if (hasData) {
        loadGame(slot);
      }
    }
  };

  const confirmOverwrite = () => {
    if (confirmSlot !== null) {
      saveGame(confirmSlot);
      setConfirmSlot(null);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleDelete = (e: React.MouseEvent, slot: number) => {
    e.stopPropagation();
    deleteSave(slot);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          setConfirmSlot(null);
          close();
        }}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl mx-4 bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white/90">
            {mode === "save" ? "Save Game" : "Load Game"}
          </h2>
          <button
            onClick={() => {
              setConfirmSlot(null);
              close();
            }}
            className="text-white/50 hover:text-white text-2xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Overwrite confirm */}
        {confirmSlot !== null && (
          <div className="px-6 py-3 bg-red-950/40 border-b border-red-500/20 flex items-center justify-between">
            <span className="text-red-300 text-sm">
              Overwrite Slot {confirmSlot}?
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmSlot(null)}
                className="px-3 py-1 text-sm text-white/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmOverwrite}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                Overwrite
              </button>
            </div>
          </div>
        )}

        {/* Slots grid */}
        <div className="grid grid-cols-2 gap-3 p-6" key={refreshKey}>
          {slots.map(({ slot, data }) => {
            const isEmpty = !data;
            const isDisabled = mode === "load" && isEmpty;

            return (
              <div
                key={slot}
                onClick={() => !isDisabled && handleSlotClick(slot, !isEmpty)}
                className={`relative text-left p-4 rounded-xl border transition-all ${
                  isDisabled
                    ? "border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-pink-500/30 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/40 text-xs font-mono">
                    Slot {slot}
                  </span>
                  {data && (
                    <button
                      onClick={(e) => handleDelete(e, slot)}
                      className="text-white/20 hover:text-red-400 text-xs transition-colors"
                      title="Delete save"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {data ? (
                  <>
                    <p className="text-white/90 text-sm font-medium truncate">
                      {data.playerName}
                    </p>
                    <p className="text-pink-300/70 text-xs truncate">
                      {data.episodeTitle}
                    </p>
                    <p className="text-white/30 text-xs mt-1">
                      {new Date(data.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-white/20 text-sm py-2">Empty Slot</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
