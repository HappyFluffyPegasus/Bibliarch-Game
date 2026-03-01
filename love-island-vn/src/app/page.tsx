import Link from "next/link";
import { VN_REGISTRY } from "@/data/vnRegistry";
import { LibraryCard } from "@/components/LibraryCard";

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 text-white">
      {/* Header */}
      <header className="pt-16 pb-12 text-center">
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400 bg-clip-text text-transparent">
          Visual Novel Library
        </h1>
        <p className="text-white/40 mt-3 text-lg">Choose your story</p>
      </header>

      {/* VN Grid */}
      <main className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {VN_REGISTRY.map((config) => (
            <LibraryCard key={config.id} config={config} />
          ))}
        </div>

        {VN_REGISTRY.length === 0 && (
          <p className="text-white/30 text-center py-20">
            No visual novels available yet.
          </p>
        )}
      </main>
    </div>
  );
}
