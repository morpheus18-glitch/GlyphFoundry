// src/App.tsx
import React, { Suspense, lazy, useEffect, useState } from "react";
const NeuralKnowledgeNetwork = lazy(() => import("./components/NeuralKnowledgeNetwork"));

type ApiNode = { id: string; kind: string; label: string; summary: string; degree: number; ts: number };
type ApiEdge = { source: string; target: string; rel: string; weight: number; ts: number };
type GraphPayload = {
  nodes: ApiNode[];
  edges: ApiEdge[];
  stats: { node_count: number; edge_count: number; window_minutes: number };
};
type TagRow = { tag_id: string; slug: string; name: string; node_id: string; confidence: number };

const BASE = import.meta.env.VITE_GRAPH_BASE || "/graph3d";
const TAGS_BASE = import.meta.env.VITE_TAGS_BASE || "/tags";
const TOKEN = import.meta.env.VITE_GRAPH_TOKEN || "";

export default function App() {
  const [graph, setGraph] = useState<GraphPayload>({
    nodes: [],
    edges: [],
    stats: { node_count: 0, edge_count: 0, window_minutes: 60 },
  });
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setLoading(true);

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

        const [gRes, tRes] = await Promise.all([
          fetch(`${BASE}/data?window_minutes=4320&limit_nodes=300&limit_edges=1500`, { headers }),
          fetch(`${TAGS_BASE}/data`, { headers }),
        ]);

        if (!gRes.ok) throw new Error(`/graph3d/data ${gRes.status}`);
        if (!tRes.ok) throw new Error(`/tags/data ${tRes.status}`);

        const g = (await gRes.json()) as GraphPayload;
        const t = (await tRes.json()) as { items: TagRow[] };

        setGraph(g);
        setTags(t.items || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="w-screen h-screen bg-black text-white">
      {/* Header */}
      <header
        className="flex items-center px-4 py-2 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur"
        style={{ minHeight: 48 }}
      >
        <strong className="text-sm md:text-base">Glyph Foundry</strong>
        <span className="ml-3 text-xs md:text-sm text-neutral-400">
          nodes: {graph.stats.node_count} • edges: {graph.stats.edge_count}
        </span>
        {loading && <span className="ml-3 text-xs text-blue-400">loading…</span>}
        {error && (
          <span className="ml-3 text-xs text-red-400" role="alert">
            error: {error}
          </span>
        )}
        <span className="ml-auto text-[11px] text-neutral-500">
          window: {graph.stats.window_minutes}m
        </span>
      </header>

      {/* Main layout */}
      <main className="w-full h-[calc(100vh-48px)] grid grid-cols-1 md:grid-cols-[1fr_320px]">
        {/* 3D Graph */}
        <section className="relative">
          <Suspense fallback={<div className="p-4 text-white">Loading 3D...</div>}>
            <NeuralKnowledgeNetwork />
          </Suspense>
        </section>

        {/* Tags panel */}
        <aside className="hidden md:flex flex-col border-l border-neutral-800 bg-neutral-950/60 overflow-auto">
          <div className="p-3 border-b border-neutral-800">
            <h3 className="text-sm font-semibold">Tags</h3>
          </div>

          {tags.length === 0 ? (
            <div className="p-4 text-neutral-500 text-sm">No tags</div>
          ) : (
            <ul className="p-3 space-y-3">
              {tags.map((t) => (
                <li key={`${t.tag_id}:${t.node_id}`} className="text-sm leading-tight">
                  <code className="text-xs bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                    {t.slug}
                  </code>{" "}
                  <span className="ml-1" title={t.tag_id}>
                    {t.name}
                  </span>
                  <div className="text-[11px] text-neutral-500 mt-1">
                    node={t.node_id.slice(0, 8)}… • conf={t.confidence}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}

