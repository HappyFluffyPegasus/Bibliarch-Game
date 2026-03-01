"use client";

import Image from "next/image";
import { useCharacters } from "@/engine/VNProvider";

interface CharacterSpriteProps {
  characterId: string;
  /** Expression narration shown near the sprite */
  expression?: string;
  /** Which sprite variant to display (e.g. "flustered", "happy") */
  spriteVariant?: string;
  /** Position on screen */
  position?: "left" | "center" | "right";
  /** Whether this character is currently speaking */
  isSpeaking?: boolean;
}

/**
 * Determine if a sprite needs CSS flipping based on its filename suffix
 * and the position it occupies on screen.
 *
 * L.png = natively faces left, R.png = natively faces right.
 * Left position should face right (toward center). Right should face left.
 */
function shouldFlip(
  spriteFile: string,
  position: "left" | "center" | "right"
): boolean {
  if (position === "center") return false;

  const facesLeft = spriteFile.endsWith("L.png");
  const facesRight = spriteFile.endsWith("R.png");

  if (!facesLeft && !facesRight) return false;

  // Left position needs to face right — flip if sprite natively faces left
  if (position === "left") return facesLeft;
  // Right position needs to face left — flip if sprite natively faces right
  return facesRight;
}

export function CharacterSprite({
  characterId,
  expression,
  spriteVariant,
  position = "center",
  isSpeaking = false,
}: CharacterSpriteProps) {
  const characters = useCharacters();
  const character = characters.find((c) => c.id === characterId);
  if (!character) return null;

  // Pick the right sprite: variant if available, otherwise base
  let spriteFile = character.sprite;
  if (spriteVariant && character.sprites?.[spriteVariant]) {
    spriteFile = character.sprites[spriteVariant];
  }

  const flip = shouldFlip(spriteFile, position);
  const isLiana = characterId === "liana";

  const positionClasses = {
    left: "left-[10%]",
    center: "left-1/2 -translate-x-1/2",
    right: "right-[10%]",
  };

  return (
    <div
      className={`absolute bottom-0 ${positionClasses[position]} transition-all duration-500`}
    >
      {/* Expression narration bubble */}
      {expression && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div className="bg-black/60 backdrop-blur-sm text-white/90 italic text-sm px-4 py-2 rounded-full border border-white/20 animate-fade-in">
            {expression}
          </div>
        </div>
      )}

      {/* Liana golden glow backdrop */}
      {isLiana && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[350px] h-[600px] md:w-[440px] md:h-[750px] bg-amber-300/20 rounded-full blur-3xl animate-pulse" />
        </div>
      )}

      {/* Character sprite */}
      <div
        className={`relative transition-all duration-300 ${
          isSpeaking ? "scale-105 brightness-110" : "brightness-90"
        }`}
      >
        <div
          className={`relative w-[403px] h-[691px] md:w-[504px] md:h-[864px] ${flip ? "-scale-x-100" : ""}`}
        >
          <Image
            src={`/sprites/${spriteFile}`}
            alt={character.name}
            fill
            className={`object-contain object-bottom ${
              isLiana
                ? "drop-shadow-[0_0_40px_rgba(251,191,36,0.5)]"
                : "drop-shadow-2xl"
            }`}
            priority
          />
        </div>
      </div>

      {/* Name tag */}
      <div className="text-center mt-1">
        <span
          className="text-xs font-bold px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm"
          style={{ color: character.color }}
        >
          {character.name}
        </span>
      </div>
    </div>
  );
}
