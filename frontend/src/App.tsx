import React, { Suspense, lazy, useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { NodesPage } from "./pages/NodesPage";
import { EmbeddingsPage } from "./pages/EmbeddingsPage";
import { SettingsPage } from "./pages/SettingsPage";

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

const GRAPH_BASE = import.meta.env.VITE_GRAPH_BASE || "/graph3d";
const TAGS_BASE = import.meta.env.VITE_TAGS_BASE || "/tags";
const GRAPH_TOKEN = import.meta.env.VITE_GRAPH_TOKEN || "";

export default function App() {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("overview");

  useEffect(() => {
    const fetchGraph = async () => {
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
      } finally {
        setLoading(false);
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
              </Suspense>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
