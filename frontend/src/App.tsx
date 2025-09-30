import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { NodesPage } from "./pages/NodesPage";
import { EmbeddingsPage } from "./pages/EmbeddingsPage";
import { SettingsPage } from "./pages/SettingsPage";

const NeuralKnowledgeNetwork = lazy(() => import("./components/NeuralKnowledgeNetwork"));
const CinematicScenes = lazy(() => import("./components/CinematicScenes"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));

type ApiNode = {
  id: string;
  kind: string;
  label: string;
  summary: string;
  degree: number;
  ts: number;
};

type ApiEdge = { source: string; target: string; rel: string; weight: number; ts: number };

type GraphPayload = {
  nodes: ApiNode[];
  edges: ApiEdge[];
  stats: { node_count: number; edge_count: number; window_minutes: number };
};

type TagRow = { tag_id: string; slug: string; name: string; node_id: string; confidence: number };

type ViewMode = "overview" | "graph" | "cinematic" | "nodes" | "embeddings" | "settings" | "admin";

const GRAPH_BASE = import.meta.env.VITE_GRAPH_BASE || "/graph3d";
const TAGS_BASE = import.meta.env.VITE_TAGS_BASE || "/tags";
const GRAPH_TOKEN = import.meta.env.VITE_GRAPH_TOKEN || "";

const WINDOW_OPTIONS = [60, 240, 1440, 4320, 10080];
const NODE_OPTIONS = [150, 300, 600, 1000];
const EDGE_OPTIONS = [500, 1500, 2500, 4000];

export default function App() {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewMode>("overview");
  const [windowMinutes, setWindowMinutes] = useState<number>(4320);
  const [limitNodes, setLimitNodes] = useState<number>(300);
  const [limitEdges, setLimitEdges] = useState<number>(1500);
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (GRAPH_TOKEN) {
      h.Authorization = `Bearer ${GRAPH_TOKEN}`;
    }
    return h;
  }, []);

  const triggerRefresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          window_minutes: windowMinutes.toString(),
          limit_nodes: limitNodes.toString(),
          limit_edges: limitEdges.toString(),
        });

        const [graphResponse, tagsResponse] = await Promise.all([
          fetch(`${GRAPH_BASE}/data?${params.toString()}`, { headers, signal: controller.signal }),
          fetch(`${TAGS_BASE}/data`, { headers, signal: controller.signal }),
        ]);

        if (!graphResponse.ok) {
          throw new Error(`/graph3d/data ${graphResponse.status}`);
        }
        if (!tagsResponse.ok) {
          throw new Error(`/tags/data ${tagsResponse.status}`);
        }

        const graphPayload = (await graphResponse.json()) as GraphPayload;
        const tagsPayload = (await tagsResponse.json()) as { items?: TagRow[] };

        if (!controller.signal.aborted) {
          setGraph(graphPayload);
          setTags(tagsPayload.items ?? []);
          setLastUpdated(new Date().toISOString());
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError((err as Error)?.message ?? "Failed to load graph");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => controller.abort();
  }, [headers, windowMinutes, limitNodes, limitEdges, refreshToken]);

  const navItems: [ViewMode, string][] = [
    ["overview", "Overview"],
    ["graph", "Graph"],
    ["cinematic", "Cinematic"],
    ["admin", "Admin"],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-blue-50 text-gray-900">
      <header className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            KG
          </div>
          <strong className="text-lg font-semibold text-gray-800">Knowledge Graph</strong>
        </div>
        <nav className="flex flex-wrap gap-2">
          {navItems.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                view === mode 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              <span>Loading...</span>
            </div>
          )}
          {!loading && graph && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                {graph.stats.node_count} Nodes
              </span>
              <span className="text-gray-300">•</span>
              <span>{graph.stats.edge_count} Connections</span>
            </div>
          )}
          {!loading && !graph && (
            <span className="text-sm text-gray-500">No data</span>
          )}
        </div>
        {error && (
          <span className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </span>
        )}
      </header>

      {view === "graph" && (
        <div className="border-b border-gray-200 bg-white/60">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Time Range:</span>
                <select
                  value={windowMinutes}
                  onChange={(event) => setWindowMinutes(Number(event.target.value))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {WINDOW_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} minutes
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Max Nodes:</span>
                <select
                  value={limitNodes}
                  onChange={(event) => setLimitNodes(Number(event.target.value))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {NODE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Max Connections:</span>
                <select
                  value={limitEdges}
                  onChange={(event) => setLimitEdges(Number(event.target.value))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
              <span className="ml-auto hidden text-sm text-gray-500 md:inline">
                Last updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={triggerRefresh}
              className="ml-auto rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Refresh Data
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 to-blue-50">
        <section className="mx-auto w-full max-w-7xl px-6 py-8">
          {view === "overview" && <Dashboard />}
          {view === "nodes" && <NodesPage />}
          {view === "embeddings" && <EmbeddingsPage />}
          {view === "settings" && <SettingsPage />}
          {view === "admin" && (
            <Suspense fallback={
              <div className="flex h-96 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                  <p className="text-sm text-gray-600">Loading admin panel...</p>
                </div>
              </div>
            }>
              <AdminDashboard />
            </Suspense>
          )}
          {view === "graph" && (
            <div className="grid h-[75vh] w-full grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
              <section className="relative flex items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center gap-3 p-8">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-sm text-gray-600">Loading 3D visualization...</p>
                  </div>
                }>
                  <NeuralKnowledgeNetwork nodes={graph?.nodes} edges={graph?.edges} />
                </Suspense>
              </section>
              <aside className="hidden overflow-auto rounded-2xl border border-gray-200 bg-white shadow-md p-6 lg:block">
                <h2 className="mb-4 text-base font-semibold text-gray-800">Knowledge Tags</h2>
                {tags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-2 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500">No tags available yet</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {tags.map((tag) => (
                      <li key={`${tag.tag_id}:${tag.node_id}`} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 hover:bg-gray-50 transition-colors">
                        <div className="text-xs font-medium text-blue-600 mb-1">{tag.slug}</div>
                        <div className="text-sm font-medium text-gray-900 mb-1">{tag.name}</div>
                        <div className="text-xs text-gray-500">
                          Node: {tag.node_id.slice(0, 8)}... • {Math.round(tag.confidence * 100)}% confidence
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          )}
          {view === "cinematic" && (
            <div className="h-[75vh] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-900 to-black shadow-2xl">
              <Suspense fallback={
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
                  <p className="text-sm text-gray-400">Loading cinematic renderer...</p>
                </div>
              }>
                <CinematicScenes />
              </Suspense>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
