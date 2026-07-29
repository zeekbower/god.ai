import { NextRequest, NextResponse } from "next/server";

// Server-side base URLs (same-host, so localhost is correct here even though
// the client-facing links elsewhere in the app use the LAN IP for browser
// access — see app/page.tsx's WIKI/JOIN THE DISCUSSION links).
const NODEBB_URL = process.env.NODEBB_URL || "http://localhost:4567";
const WIKIJS_URL = process.env.WIKIJS_URL || "http://localhost:4568";

// Public-facing wiki base used to build result links a browser can follow —
// matches the hardcoded href already used for the WIKI button in page.tsx.
const WIKI_PUBLIC_URL = process.env.NEXT_PUBLIC_WIKI_URL || "http://192.168.1.5:4568";

export type SearchResult = {
  source: "forum" | "wiki";
  title: string;
  snippet: string;
  url: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function snippetAround(text: string, maxLen = 180): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trimEnd()}…`;
}

async function searchForum(term: string): Promise<SearchResult[]> {
  const res = await fetch(
    `${NODEBB_URL}/api/search?term=${encodeURIComponent(term)}&in=titlesposts`,
    { headers: { Accept: "application/json" }, cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const posts: Array<{ url: string; content: string; topic?: { title?: string } }> =
    data.posts || [];
  return posts.map((p) => ({
    source: "forum" as const,
    title: p.topic?.title || "Forum post",
    snippet: snippetAround(p.content),
    url: p.url,
  }));
}

async function searchWiki(term: string): Promise<SearchResult[]> {
  const res = await fetch(`${WIKIJS_URL}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($q: String!) { pages { search(query: $q) { results { title description path } } } }`,
      variables: { q: term },
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const results: Array<{ title: string; description?: string; path: string }> =
    data?.data?.pages?.search?.results || [];
  return results.map((r) => ({
    source: "wiki" as const,
    title: r.title,
    snippet: r.description ? stripHtml(r.description) : "Divinity Data wiki page",
    url: `${WIKI_PUBLIC_URL}/${r.path}`,
  }));
}

export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (!term) {
    return NextResponse.json({ results: [] });
  }

  const [forumResults, wikiResults] = await Promise.all([
    searchForum(term).catch(() => []),
    searchWiki(term).catch(() => []),
  ]);

  return NextResponse.json({ results: [...wikiResults, ...forumResults] });
}
