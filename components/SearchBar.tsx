"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/app/api/search/route";

const DEBOUNCE_MS = 300;

/**
 * Expands from a pill button into a text input (matching the WIKI / JOIN THE
 * DISCUSSION buttons it sits next to) and queries /api/search, which merges
 * NodeBB forum posts and Wiki.js pages into one ranked-by-source list.
 */
export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      debounceRef.current = setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div ref={containerRef} className="pointer-events-auto relative">
      {open ? (
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search the discussion & wiki…"
          className="w-40 rounded-full border border-amber-200/30 bg-black/40 px-3 py-1.5 text-[10px] tracking-widest text-amber-100/90 placeholder:text-amber-200/40 outline-none transition-colors focus:border-amber-200/70 sm:w-56 sm:px-4 sm:py-2 sm:text-xs"
        />
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Search"
          className="rounded-full border border-amber-200/30 px-3 py-1.5 text-[10px] tracking-widest text-amber-100/70 transition-colors hover:border-amber-200/70 hover:text-amber-100 sm:px-4 sm:py-2 sm:text-xs"
        >
          SEARCH
        </button>
      )}

      {open && query.trim() && (
        <div className="absolute bottom-full left-1/2 mb-3 max-h-[50vh] w-[80vw] max-w-sm -translate-x-1/2 overflow-y-auto rounded-2xl border border-amber-200/20 bg-black/85 p-2 text-left backdrop-blur-md">
          {loading && (
            <p className="px-3 py-2 text-[10px] tracking-widest text-amber-200/50">
              Searching…
            </p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-[10px] tracking-widest text-amber-200/50">
              No results.
            </p>
          )}
          {!loading &&
            results.map((r, i) => (
              <a
                key={`${r.source}-${r.url}-${i}`}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl px-3 py-2 transition-colors hover:bg-amber-200/10"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[8px] tracking-widest ${
                      r.source === "wiki"
                        ? "bg-amber-200/20 text-amber-100"
                        : "bg-emerald-200/10 text-emerald-200/80"
                    }`}
                  >
                    {r.source === "wiki" ? "WIKI" : "FORUM"}
                  </span>
                  <span className="truncate text-xs text-amber-100/90">{r.title}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-amber-200/50">
                  {r.snippet}
                </p>
              </a>
            ))}
        </div>
      )}
    </div>
  );
}
