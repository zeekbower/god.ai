"use client";

import dynamic from "next/dynamic";
import AmbientAudio from "@/components/AmbientAudio";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Home() {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      <Scene />

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ boxShadow: "inset 0 0 18vw 2vw rgba(0,0,0,0.85)" }}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start pt-14 text-center">
        <h1 className="font-serif text-4xl tracking-[0.35em] text-amber-100/90 drop-shadow-[0_0_25px_rgba(255,180,80,0.55)] md:text-6xl">
          DIVINITY.IS
        </h1>
        <p className="mt-3 max-w-xl px-6 text-xs tracking-[0.12em] text-amber-200/60 md:text-sm">
          Artificial Intelligence joins the search to prove or disprove the existence of a higher power
        </p>
      </div>

      {/* Fixed relative to the viewport-sized <main>, so it re-centers and stays
          30px above the bottom on its own whenever the window is resized. */}
      <div
        className="absolute z-20 inline-flex items-center gap-3 whitespace-nowrap rounded-full px-5 py-3 backdrop-blur-sm"
        style={{
          left: "50%",
          bottom: "30px",
          transform: "translateX(-50%)",
          background: "linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(255,215,0,0.2) 100%)",
        }}
      >
        <a
          href="http://localhost:4568"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-amber-200/30 px-4 py-2 text-xs tracking-widest text-amber-100/70 transition-colors hover:border-amber-200/70 hover:text-amber-100"
        >
          WIKI
        </a>

        <a
          href="http://localhost:4567"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-amber-200/30 px-5 py-2 text-xs tracking-[0.2em] text-amber-100/70 transition-colors hover:border-amber-200/70 hover:text-amber-100"
        >
          JOIN THE DISCUSSION
        </a>

        <AmbientAudio />
      </div>
    </main>
  );
}
