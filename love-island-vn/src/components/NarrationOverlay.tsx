"use client";

import type { NarrationStyle } from "@/types";

interface NarrationOverlayProps {
  text: string;
  style?: NarrationStyle;
  onAdvance: () => void;
}

const styleConfig: Record<NarrationStyle, { className: string; prefix: string }> = {
  action: {
    className: "text-white/90 text-xl",
    prefix: "",
  },
  emotion: {
    className: "text-pink-300 text-xl italic",
    prefix: "",
  },
  thought: {
    className: "text-blue-200/80 text-lg italic",
    prefix: "",
  },
  whisper: {
    className: "text-white/50 text-base italic tracking-wide",
    prefix: "",
  },
};

export function NarrationOverlay({
  text,
  style = "action",
  onAdvance,
}: NarrationOverlayProps) {
  const config = styleConfig[style];

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer z-10"
      onClick={onAdvance}
    >
      <div className="max-w-2xl mx-8 text-center animate-fade-in">
        <p className={`${config.className} leading-relaxed drop-shadow-lg`}>
          {config.prefix}{text}
        </p>
        <div className="mt-8 text-white/30 text-sm animate-bounce">
          Click to continue
        </div>
      </div>
    </div>
  );
}
