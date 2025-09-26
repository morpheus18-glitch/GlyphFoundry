import React, { Suspense, lazy, useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { NodesPage } from "./pages/NodesPage";
import { EmbeddingsPage } from "./pages/EmbeddingsPage";
import { SettingsPage } from "./pages/SettingsPage";

=======
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

type ViewMode = "overview" | "graph" | "cinematic" | "nodes" | "embeddings" | "settings";

const import.meta.env.VITE_GRAPH_BASE || "/graph3d";
const TAGS_BASE = import.meta.env.VITE_TAGS_BASE || "/tags";
const GRAPH_TOKEN = import.meta.env.VITE_GRAPH_TOKEN || "";
=======
const WINDOW_OPTIONS = [60, 240, 1440, 4320, 10080];
const NODE_OPTIONS = [150, 300, 600, 1000];
const EDGE_OPTIONS = [500, 1500, 2500, 4000];

type ViewMode = "graph" | "cinematic";


export default function App() {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<ViewMode>("overview");

  useEffect(() => {
    const fetchGraph = async () => {
=======
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
        setLoading(true);

        setError(null);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (GRAPH_TOKEN) headers["Authorization"] = `Bearer ${GRAPH_TOKEN}`;
        const [graphResponse, tagsResponse] = await Promise.all([
          fetch(`${GRAPH_BASE}/data?window_minutes=4320&limit_nodes=300&limit_edges=1500`, { headers }),
          fetch(`${TAGS_BASE}/data`, { headers }),
        ]);
        if (!graphResponse.ok) throw new Error(`/graph3d/data ${graphResponse.status}`);
        if (!tagsResponse.ok) throw new Error(`/tags/data ${tagsResponse.status}`);
        const graphPayload = (await graphResponse.json()) as GraphPayload;
        const tagPayload = (await tagsResponse.json()) as { items: TagRow[] };
        setGraph(graphPayload);
        setTags(tagPayload.items || []);
      } catch (err) {
        setError((err as Error).message);
=======

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
    
    fetchGraph();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-900 bg-neutral-950/90 px-4 py-3">
        <strong className="text-base">Quantum Nexus</strong>
        <nav className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em]">
          {(
            [
              ["overview", "Overview"],
              ["graph", "Graph"],
              ["cinematic", "Cinematic"],
              ["nodes", "Nodes"],
              ["embeddings", "Embeddings"],
              ["settings", "Settings"],
            ] as [ViewMode, string][]
          ).map(([mode, label]) => (
=======
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
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-full px-3 py-1 transition-colors ${
                view === mode ? "bg-white text-black" : "bg-neutral-900 text-neutral-400 hover:text-white"
              }`}
            >
              {label}
            </button>

          ))}
        </nav>
        <span className="ml-auto text-[11px] text-neutral-500">
          {loading ? "Loading graph…" : graph ? `Nodes ${graph.stats.node_count} • Edges ${graph.stats.edge_count}` : "Graph offline"}
        </span>
        {error && (
          <span className="rounded border border-red-500 bg-red-900/50 px-2 py-1 text-[11px] text-red-200">{error}</span>
        )}
      </header>
      <main className="flex-1 overflow-auto">
        <section className="mx-auto w-full max-w-6xl px-4 py-6">
          {view === "overview" && <Dashboard />}
          {view === "nodes" && <NodesPage />}
          {view === "embeddings" && <EmbeddingsPage />}
          {view === "settings" && <SettingsPage />}
          {view === "graph" && (
            <div className="grid h-[70vh] w-full grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
              <section className="relative flex items-center justify-center rounded border border-neutral-800 bg-black">
                <Suspense fallback={<div className="p-4 text-sm text-neutral-400">Loading 3D renderer…</div>}>
                  <NeuralKnowledgeNetwork />
                </Suspense>
              </section>
              <aside className="hidden overflow-auto rounded border border-neutral-800 bg-neutral-950/60 p-4 lg:block">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Tags</h2>
                {tags.length === 0 ? (
                  <p className="text-xs text-neutral-500">No tags available.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {tags.map((tag) => (
                      <li key={`${tag.tag_id}:${tag.node_id}`} className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-neutral-500">{tag.slug}</div>
                        <div className="text-sm text-neutral-100">{tag.name}</div>
                        <div className="text-[11px] text-neutral-500">
                          node {tag.node_id.slice(0, 8)}… • confidence {tag.confidence.toFixed(2)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          )}
          {view === "cinematic" && (
            <div className="h-[70vh] w-full overflow-hidden rounded border border-neutral-800 bg-black">
              <Suspense fallback={<div className="p-4 text-sm text-neutral-400">Loading cinematic renderer…</div>}>
                <CinematicScenes />
=======
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
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
