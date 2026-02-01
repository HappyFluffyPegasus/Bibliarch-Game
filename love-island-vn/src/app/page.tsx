"use client";

import { useVNStore } from "@/engine/vnEngine";
import { TitleScreen } from "@/components/TitleScreen";
import { VNScene } from "@/components/VNScene";
import { SaveLoadMenu } from "@/components/SaveLoadMenu";

export default function Home() {
  const isStarted = useVNStore((s) => s.isStarted);

  return (
    <>
      {isStarted ? <VNScene /> : <TitleScreen />}
      <SaveLoadMenu />
    </>
  );
}
