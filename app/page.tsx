"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { CSSProperties } from "react";
import AmbientAudio from "@/components/AmbientAudio";
import SearchBar from "@/components/SearchBar";
import ActivityIndicator from "@/components/ActivityIndicator";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

// 4px black outline plus a golden-white glow behind both the fill and the
// stroke. text-shadow has no native "spread" like box-shadow, so it's
// approximated with a tight inner layer (spread) and a looser outer layer
// (blur), both at the same 60% opacity, sized in em so it scales with
// whichever element's own font-size it's applied to.
const TITLE_TEXT_EFFECT: CSSProperties = {
  WebkitTextStroke: "4px black",
  paintOrder: "stroke fill",
  textShadow: "0 0 0.3em rgba(255,250,230,0.6), 0 0 0.8em rgba(255,250,230,0.6)",
};

export default function Home() {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      <Scene />

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ boxShadow: "inset 0 0 18vw 2vw rgba(0,0,0,0.85)" }}
      />

      <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-6 sm:top-6">
        <ActivityIndicator />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start px-4 pt-8 text-center sm:pt-14">
        {/* Fluid font-size (clamp) rather than fixed breakpoint jumps, so this
            scales continuously across phone/tablet/desktop widths — including
            on live resize, since clamp() recomputes from vw on every reflow.
            tracking is in em, so it shrinks proportionally with the font.
            Stroke + glow are inline styles (not Tailwind classes) since
            -webkit-text-stroke and multi-layer text-shadow need exact values;
            glow blur/spread are in em so they scale with each element's own
            font-size rather than needing separate title/subtitle tuning. */}
        <h1
          className="font-serif text-[clamp(1.75rem,7vw,3.75rem)] tracking-[0.35em] text-amber-100/90"
          style={TITLE_TEXT_EFFECT}
        >
          DIVINITY.IS
        </h1>
        <p
          className="mt-3 max-w-xl text-[clamp(0.65rem,2.3vw,0.875rem)] tracking-[0.12em] text-amber-200/60"
          style={TITLE_TEXT_EFFECT}
        >
          Artificial Intelligence joins the search to prove or disprove the existence of a higher power
        </p>
      </div>

      {/* Fixed relative to the viewport-sized <main>, so it re-centers and stays
          30px above the bottom on its own whenever the window is resized.
          Sizing/padding/gap shrink on narrow screens, and the tray is allowed
          to wrap onto a second line as a safety net on very small phones. */}
      <div
        className="absolute z-20 flex max-w-[94vw] flex-col items-center gap-1.5 rounded-3xl px-3 py-2 backdrop-blur-sm sm:gap-2 sm:px-5 sm:py-3"
        style={{
          left: "50%",
          bottom: "30px",
          transform: "translateX(-50%)",
          background: "linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(255,215,0,0.2) 100%)",
        }}
      >
        <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <a
            href="http://192.168.1.5:4568"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-amber-200/30 px-3 py-1.5 text-[10px] tracking-widest text-amber-100/70 transition-colors hover:border-amber-200/70 hover:text-amber-100 sm:px-4 sm:py-2 sm:text-xs"
          >
            WIKI
          </a>

          <a
            href="http://192.168.1.5:4567"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-amber-200/30 px-3 py-1.5 text-[10px] tracking-[0.1em] whitespace-nowrap text-amber-100/70 transition-colors hover:border-amber-200/70 hover:text-amber-100 sm:px-5 sm:py-2 sm:text-xs sm:tracking-[0.2em]"
          >
            JOIN THE DISCUSSION
          </a>

          <SearchBar />

          <AmbientAudio />
        </div>

        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <Link
            href="/best-debates"
            target="_blank"
            className="rounded-full border border-amber-200/20 px-2.5 py-1 text-[9px] tracking-widest text-amber-200/50 transition-colors hover:border-amber-200/50 hover:text-amber-100/90 sm:px-3 sm:py-1 sm:text-[10px]"
          >
            BEST DEBATES
          </Link>

          <Link
            href="/mind-changed"
            target="_blank"
            className="rounded-full border border-amber-200/20 px-2.5 py-1 text-[9px] tracking-widest text-amber-200/50 transition-colors hover:border-amber-200/50 hover:text-amber-100/90 sm:px-3 sm:py-1 sm:text-[10px]"
          >
            CHANGED THEIR MIND
          </Link>
        </div>
      </div>
    </main>
  );
}
