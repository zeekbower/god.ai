import { NextResponse } from "next/server";

const NODEBB_URL = process.env.NODEBB_URL || "http://localhost:4567";
const NODEBB_PUBLIC_URL = process.env.NEXT_PUBLIC_NODEBB_URL || "http://192.168.1.5:4567";

export type ActivityResponse = {
  totalPosts: number;
  totalTopics: number;
  postsLast24h: number;
  latestPost: {
    author: string;
    title: string;
    url: string;
    timestampISO: string;
  } | null;
};

type NodeBBRoot = { categories?: Array<{ totalPostCount?: number; totalTopicCount?: number }> };
type NodeBBTopic = {
  tid: number;
  title: string;
  lastposttime?: number;
  timestamp: number;
  user?: { username?: string };
  teaser?: { user?: { username?: string }; timestamp?: number; pid?: number };
};
type NodeBBRecent = { topics?: NodeBBTopic[] };

async function fetchJson<T>(url: string): Promise<T | Record<string, never>> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

export async function GET() {
  const [root, recent] = await Promise.all([
    fetchJson<NodeBBRoot>(`${NODEBB_URL}/api/`),
    fetchJson<NodeBBRecent>(`${NODEBB_URL}/api/recent?page=1`),
  ]);

  const rootCategories = root.categories || [];
  const totalPosts = rootCategories.reduce((sum, c) => sum + (c.totalPostCount || 0), 0);
  const totalTopics = rootCategories.reduce((sum, c) => sum + (c.totalTopicCount || 0), 0);

  const topics = recent.topics || [];

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const postsLast24h = topics.filter((t) => (t.lastposttime || t.timestamp) >= dayAgo).length;

  const latest = topics[0];
  const latestPost = latest
    ? {
        author: latest.teaser?.user?.username || latest.user?.username || "unknown",
        title: latest.title,
        url: `${NODEBB_PUBLIC_URL}/topic/${latest.tid}`,
        timestampISO: new Date(latest.lastposttime || latest.timestamp).toISOString(),
      }
    : null;

  const body: ActivityResponse = {
    totalPosts,
    totalTopics,
    postsLast24h,
    latestPost,
  };

  return NextResponse.json(body);
}
