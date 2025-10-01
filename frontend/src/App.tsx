import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import NeuralKnowledgeNetwork from "./components/NeuralKnowledgeNetwork";

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

type ViewMode = "network" | "overview" | "admin";

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
  const [view, setView] = useState<ViewMode>("network");
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
    ["network", "Knowledge Network"],
    ["overview", "Overview"],
    ["admin", "Admin"],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-black text-gray-100">
      <header className="absolute top-0 left-0 right-0 z-50 flex flex-wrap items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 via-red-600 to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/50">
            GF
          </div>
          <strong className="text-xl font-bold text-white tracking-wide">Glyph Foundry</strong>
        </div>
        <nav className="flex flex-wrap gap-2">
          {navItems.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                view === mode 
                  ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/50" 
                  : "bg-white/10 text-gray-300 hover:bg-white/20 border border-white/20"
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


      <main className="flex-1 overflow-hidden bg-black">
        <section className="h-full w-full">
          {view === "overview" && (
            <div className="mx-auto w-full max-w-7xl px-6 py-8">
              <Dashboard />
            </div>
          )}
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
          {view === "network" && (
            <div className="absolute inset-0 top-20">
              <section className="relative h-full w-full bg-black">
                <NeuralKnowledgeNetwork nodes={graph?.nodes} edges={graph?.edges} />
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
