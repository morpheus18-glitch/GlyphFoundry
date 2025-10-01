import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { DataManagement } from "./pages/DataManagement";
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

type ViewMode = "network" | "data" | "overview" | "admin";

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setView("network");
  }, []);

  const navItems: [ViewMode, string][] = [
    ["network", "Knowledge Network"],
    ["data", "Data"],
    ["overview", "Overview"],
    ["admin", "Admin"],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0a0a0f] via-[#050508] to-black text-gray-100">
      <header className="absolute top-0 left-0 right-0 z-50 flex flex-wrap items-center gap-4 bg-gradient-to-b from-black/80 via-black/60 to-transparent backdrop-blur-xl border-b border-cyan-500/10 px-6 py-4 shadow-2xl shadow-cyan-500/5">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-fuchsia-600 flex items-center justify-center text-white font-black text-xl shadow-2xl shadow-cyan-500/50 animate-pulse">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-fuchsia-600 opacity-50 blur-xl animate-pulse"></div>
            <span className="relative z-10">GF</span>
          </div>
          <div className="flex flex-col">
            <strong className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-fuchsia-300 tracking-wider">
              GLYPH FOUNDRY
            </strong>
            <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/60 font-semibold">Cinematic Knowledge OS</span>
          </div>
        </div>
        <nav className="flex flex-wrap gap-3">
          {navItems.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                view === mode 
                  ? "bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 text-white shadow-2xl shadow-cyan-500/50" 
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-400/50 backdrop-blur-sm"
              }`}
            >
              {view === mode && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 via-purple-400/30 to-fuchsia-400/30 animate-pulse"></div>
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {loading && (
            <div className="flex items-center gap-3 text-sm">
              <div className="relative h-5 w-5">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping"></div>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
              </div>
              <span className="text-cyan-400 font-semibold">Syncing...</span>
            </div>
          )}
          {!loading && graph && (
            <div className="flex items-center gap-4 text-sm font-semibold">
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50"></div>
                <span className="text-cyan-300">{graph.stats.node_count}</span>
                <span className="text-cyan-500/60">Nodes</span>
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50"></div>
                <span className="text-purple-300">{graph.stats.edge_count}</span>
                <span className="text-purple-500/60">Links</span>
              </span>
            </div>
          )}
          {!loading && !graph && (
            <span className="text-sm text-gray-600 font-semibold">Initializing...</span>
          )}
        </div>
        {error && (
          <span className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300 font-semibold backdrop-blur-sm" role="alert">
            {error}
          </span>
        )}
      </header>


      <main className="flex-1 overflow-hidden bg-black">
        <section className="h-full w-full">
          {view === "data" && (
            <div className="absolute inset-0 top-20 overflow-y-auto">
              <DataManagement onNodeSelect={handleNodeSelect} />
            </div>
          )}
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
                <NeuralKnowledgeNetwork 
                  nodes={graph?.nodes} 
                  edges={graph?.edges}
                  selectedNodeId={selectedNodeId}
                />
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
