// src/App.tsx
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
const NeuralKnowledgeNetwork = lazy(() => import("./components/NeuralKnowledgeNetwork"));
const CinematicScenes = lazy(() => import("./components/CinematicScenes"));

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

const WINDOW_OPTIONS = [60, 240, 1440, 4320, 10080];
const NODE_OPTIONS = [150, 300, 600, 1000];
const EDGE_OPTIONS = [500, 1500, 2500, 4000];

type ViewMode = "graph" | "cinematic";

export default function App() {
  const [graph, setGraph] = useState<GraphPayload>({
    nodes: [],
    edges: [],
    stats: { node_count: 0, edge_count: 0, window_minutes: 60 },
  });
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("graph");
  const [windowMinutes, setWindowMinutes] = useState<number>(4320);
  const [limitNodes, setLimitNodes] = useState<number>(300);
  const [limitEdges, setLimitEdges] = useState<number>(1500);
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
    return h;
  }, []);

  const triggerRefresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        setError(null);
        setLoading(true);

        const params = new URLSearchParams({
          window_minutes: windowMinutes.toString(),
          limit_nodes: limitNodes.toString(),
          limit_edges: limitEdges.toString(),
        });

        const [gRes, tRes] = await Promise.all([
          fetch(`${BASE}/data?${params.toString()}`, { headers, signal: controller.signal }),
          fetch(`${TAGS_BASE}/data`, { headers, signal: controller.signal }),
        ]);

        if (!gRes.ok) throw new Error(`/graph3d/data ${gRes.status}`);
        if (!tRes.ok) throw new Error(`/tags/data ${tRes.status}`);

        const g = (await gRes.json()) as GraphPayload;
        const t = (await tRes.json()) as { items: TagRow[] };

        setGraph(g);
        setTags(t.items || []);
        setLastUpdated(new Date().toISOString());
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setError(e?.message || "Failed to load");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [headers, windowMinutes, limitNodes, limitEdges, refreshToken]);

  return (
    <div className="w-screen h-screen bg-black text-white">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-2 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur"
        style={{ minHeight: 48 }}
      >
        <strong className="text-sm md:text-base">Glyph Foundry</strong>
        <span className="hidden sm:inline text-xs md:text-sm text-neutral-400">
          nodes: {graph.stats.node_count} • edges: {graph.stats.edge_count}
        </span>
        {loading && <span className="text-xs text-blue-400">loading…</span>}
        {error && (
          <span className="text-xs text-red-400" role="alert">
            error: {error}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          <div className="hidden lg:flex items-center gap-2">
            <label className="flex items-center gap-1">
              <span className="uppercase tracking-[0.2em] text-[10px] text-neutral-500">Window</span>
              <select
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Number(e.target.value))}
                className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-200 focus:border-white focus:outline-none"
              >
                {WINDOW_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}m
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="uppercase tracking-[0.2em] text-[10px] text-neutral-500">Nodes</span>
              <select
                value={limitNodes}
                onChange={(e) => setLimitNodes(Number(e.target.value))}
                className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-200 focus:border-white focus:outline-none"
              >
                {NODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="uppercase tracking-[0.2em] text-[10px] text-neutral-500">Edges</span>
              <select
                value={limitEdges}
                onChange={(e) => setLimitEdges(Number(e.target.value))}
                className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-200 focus:border-white focus:outline-none"
              >
                {EDGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {lastUpdated && (
            <span className="hidden md:inline text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={triggerRefresh}
            className="rounded-full border border-neutral-800 bg-neutral-950/80 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-neutral-400 transition-colors hover:text-white"
          >
            Refresh
          </button>
          <nav className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-950/80 p-1">
            <button
              type="button"
              onClick={() => setView("graph")}
              className={`px-3 py-1 text-[11px] uppercase tracking-[0.2em] rounded-full transition-colors ${
                view === "graph"
                  ? "bg-white text-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Graph
            </button>
            <button
              type="button"
              onClick={() => setView("cinematic")}
              className={`px-3 py-1 text-[11px] uppercase tracking-[0.2em] rounded-full transition-colors ${
                view === "cinematic"
                  ? "bg-white text-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Cinematic
            </button>
          </nav>
        </div>
      </header>

      <main className="w-full h-[calc(100vh-48px)]">
        {view === "graph" ? (
          <div className="grid h-full w-full grid-cols-1 md:grid-cols-[1fr_320px]">
            <section className="relative">
              <Suspense fallback={<div className="p-4 text-white">Loading 3D...</div>}>
                <NeuralKnowledgeNetwork nodes={graph.nodes} edges={graph.edges} />
              </Suspense>
            </section>
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
          </div>
        ) : (
          <section className="h-full w-full">
            <Suspense fallback={<div className="p-4 text-white">Loading cinematic renderer…</div>}>
              <CinematicScenes />
            </Suspense>
          </section>
        )}
      </main>
    </div>
  );
}

