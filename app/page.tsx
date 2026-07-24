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

      <a
        href="http://localhost:4567"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-200/30 px-5 py-2 text-xs tracking-[0.2em] text-amber-100/70 transition-colors hover:border-amber-200/70 hover:text-amber-100"
      >
        JOIN THE DISCUSSION
      </a>

      <AmbientAudio />
    </main>
  );
}
