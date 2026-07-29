"use client";

import { useEffect, useState } from "react";
import type { ActivityResponse } from "@/app/api/activity/route";

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Honest activity signal, not a fabricated "N users online" counter — this
 * project runs on batch bot cycles rather than a 24/7 live chat, so it shows
 * the real most-recent post and a real rolling post count instead of
 * pretending to be busier than it is.
 */
export default function ActivityIndicator() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/activity");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // silently skip a failed poll — keep showing the last good data
      }
    }
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  if (!data || !data.latestPost) return null;

  return (
    <a
      href={data.latestPost.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-200/20 bg-black/30 px-3 py-1.5 text-[10px] tracking-wide text-amber-200/60 backdrop-blur-sm transition-colors hover:border-amber-200/50 hover:text-amber-100"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <span className="truncate">
        {data.latestPost.author} · {timeAgo(data.latestPost.timestampISO)}
      </span>
      <span className="hidden text-amber-200/40 sm:inline">
        · {data.postsLast24h} post{data.postsLast24h === 1 ? "" : "s"} today
      </span>
    </a>
  );
}
