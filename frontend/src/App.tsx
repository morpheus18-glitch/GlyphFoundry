import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { DataManagement } from "./pages/DataManagement";
import { UserSettings } from "./pages/UserSettings";
import { Walkthrough } from "./components/Walkthrough";
import NeuralKnowledgeNetwork from "./components/NeuralKnowledgeNetwork";
import { G6GraphRenderer } from "./components/G6GraphRenderer";
import { ProjectRoadmap } from "./components/ProjectRoadmap";
import { UnifiedRenderer } from "./renderers/UnifiedRenderer";

const AdminDashboard = lazy(() => import("./admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));

type ApiNode = {
  id: string;
  kind: string;
  label: string;
  summary: string;
  degree: number;
  ts: number;
  x?: number;
  y?: number;
  z?: number;
  size?: number;
  importance?: number;
};

type ApiEdge = { source: string; target: string; rel: string; weight: number; ts: number };

type GraphPayload = {
  nodes: ApiNode[];
  edges: ApiEdge[];
  stats: { node_count: number; edge_count: number; window_minutes: number };
};

type TagRow = { tag_id: string; slug: string; name: string; node_id: string; confidence: number };

type ViewMode = "network" | "data" | "overview" | "settings" | "admin" | "roadmap";
type RendererMode = "babylon" | "threejs" | "g6";

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
  const [renderer, setRenderer] = useState<RendererMode>("babylon");

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (GRAPH_TOKEN) {
      h.Authorization = `Bearer ${GRAPH_TOKEN}`;
    }
    return h;
  }, []);

  const triggerRefresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  // Load and apply theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await fetch('/api/v1/user/settings');
        if (response.ok) {
          const settings = await response.json();
          const theme = settings.theme || 'dark';
          document.documentElement.setAttribute('data-theme', theme);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimeout: NodeJS.Timeout | null = null;

    const fetchData = async (retryCount = 0) => {
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
        
        const errorMessage = (err as Error)?.message ?? "Failed to load graph";
        const isConnectionError = errorMessage.includes('fetch') || errorMessage.includes('network');
        
        if (isConnectionError && retryCount < 5) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`Backend not ready, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/5)`);
          retryTimeout = setTimeout(() => fetchData(retryCount + 1), retryDelay);
        } else {
          setError(errorMessage);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [headers, windowMinutes, limitNodes, limitEdges, refreshToken]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setWindowMinutes(525600); // Expand to 1 year to ensure node is visible
    setRefreshToken(prev => prev + 1); // Trigger data refresh
    setView("network");
  }, []);

  const navItems: [ViewMode, string][] = [
    ["network", "Knowledge Network"],
    ["data", "Data"],
    ["overview", "Overview"],
    ["roadmap", "Roadmap"],
    ["settings", "Settings"],
    ["admin", "Admin"],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0a0a0f] via-[#050508] to-black text-gray-100">
      <header className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/95 via-black/80 to-transparent backdrop-blur-xl border-b border-cyan-500/10 shadow-2xl shadow-cyan-500/5">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-4">
          <div className="flex items-center justify-between md:justify-start gap-3 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative h-8 w-8 md:h-12 md:w-12 rounded-lg md:rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-fuchsia-600 flex items-center justify-center text-white font-black text-base md:text-xl shadow-2xl shadow-cyan-500/50">
                <span className="relative z-10">GF</span>
              </div>
              <div className="flex flex-col">
                <strong className="text-base md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-fuchsia-300 tracking-wider leading-tight">
                  GLYPH FOUNDRY
                </strong>
                <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-cyan-500/60 font-semibold">Cinematic Knowledge OS</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:hidden">
              {!loading && graph && (
                <>
                  <span className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-semibold">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                    <span className="text-cyan-300">{graph.stats.node_count}</span>
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] font-semibold">
                    <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"></div>
                    <span className="text-purple-300">{graph.stats.edge_count}</span>
                  </span>
                </>
              )}
            </div>
          </div>
          
          <nav className="flex flex-wrap gap-1.5 md:gap-3 -mt-1 md:mt-0">
            {navItems.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`relative overflow-hidden rounded-md md:rounded-xl px-2.5 md:px-5 py-1 md:py-2.5 text-[10px] md:text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                  view === mode 
                    ? "bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 text-white shadow-xl shadow-cyan-500/50" 
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-400/50 backdrop-blur-sm"
                }`}
              >
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </nav>
          
          <div className="hidden md:flex items-center gap-3 md:gap-4 md:ml-auto">
            {loading && (
              <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
                <div className="relative h-4 w-4 md:h-5 md:w-5">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping"></div>
                  <div className="h-4 w-4 md:h-5 md:w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
                </div>
                <span className="text-cyan-400 font-semibold">Syncing...</span>
              </div>
            )}
            {!loading && graph && (
              <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm font-semibold">
                <span className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                  <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50"></div>
                  <span className="text-cyan-300">{graph.stats.node_count}</span>
                  <span className="text-cyan-500/60">Nodes</span>
                </span>
                <span className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50"></div>
                  <span className="text-purple-300">{graph.stats.edge_count}</span>
                  <span className="text-purple-500/60">Links</span>
                </span>
              </div>
            )}
          </div>
          {error && (
            <span className="rounded-md md:rounded-xl border border-red-500/50 bg-red-500/10 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm text-red-300 font-semibold backdrop-blur-sm" role="alert">
              {error}
            </span>
          )}
        </div>
      </header>


      <main className="flex-1 overflow-hidden bg-black">
        <section className="h-full w-full">
          {view === "data" && (
            <div className="absolute inset-0 top-[100px] md:top-20 overflow-y-auto">
              <DataManagement onNodeSelect={handleNodeSelect} />
            </div>
          )}
          {view === "overview" && (
            <div className="absolute inset-0 top-[100px] md:top-20 overflow-y-auto px-4 md:px-6 py-6 md:py-8">
              <div className="mx-auto w-full max-w-7xl">
                <Dashboard />
              </div>
            </div>
          )}
          {view === "settings" && (
            <div className="absolute inset-0 top-[100px] md:top-20 overflow-y-auto">
              <UserSettings />
            </div>
          )}
          {view === "roadmap" && (
            <div className="absolute inset-0 top-[100px] md:top-20">
              <ProjectRoadmap />
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
            <div className="absolute inset-0 top-[100px] md:top-20">
              <section className="relative h-full w-full bg-black">
                {/* Renderer toggle */}
                <div className="absolute top-2 md:top-4 right-2 md:right-4 z-50 flex gap-1.5 md:gap-2 bg-black/80 backdrop-blur-sm px-2 md:px-4 py-1.5 md:py-2 rounded-lg border border-cyan-500/30">
                  <button
                    onClick={() => setRenderer("babylon")}
                    className={`px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                      renderer === "babylon"
                        ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/50"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300"
                    }`}
                  >
                    <span className="hidden sm:inline">🎮 Babylon</span>
                    <span className="sm:hidden">🎮 B</span>
                  </button>
                  <button
                    onClick={() => setRenderer("g6")}
                    className={`px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                      renderer === "g6"
                        ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/50"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300"
                    }`}
                  >
                    <span className="hidden sm:inline">⚡ G6 WebGL</span>
                    <span className="sm:hidden">⚡ G6</span>
                  </button>
                  <button
                    onClick={() => setRenderer("threejs")}
                    className={`px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                      renderer === "threejs"
                        ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/50"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300"
                    }`}
                  >
                    <span className="hidden sm:inline">🎬 Three.js</span>
                    <span className="sm:hidden">🎬 3D</span>
                  </button>
                </div>

                {/* Conditional renderer */}
                {renderer === "babylon" ? (
                  <UnifiedRenderer
                    nodes={graph?.nodes?.map(n => ({
                      id: n.id,
                      x: n.x || 0,
                      y: n.y || 0,
                      z: n.z || 0,
                      size: n.size || 10,
                      color: n.importance && n.importance > 0.5 ? '#ff00ff' : '#00ffff',
                      label: n.label
                    })) || []}
                    edges={graph?.edges?.map(e => ({
                      source: e.source,
                      target: e.target,
                      weight: e.weight
                    })) || []}
                    onNodeClick={(nodeId) => {
                      setSelectedNodeId(nodeId);
                    }}
                  />
                ) : renderer === "g6" ? (
                  <G6GraphRenderer 
                    tenantId="default-tenant"
                    onNodeSelect={(node) => {
                      setSelectedNodeId(node.id);
                    }}
                  />
                ) : (
                  <NeuralKnowledgeNetwork 
                    nodes={graph?.nodes} 
                    edges={graph?.edges}
                    selectedNodeId={selectedNodeId}
                  />
                )}
              </section>
            </div>
          )}
        </section>
      </main>
      
      <Walkthrough 
        onChangeView={(newView) => setView(newView as ViewMode)}
        onComplete={() => console.log('Walkthrough completed')}
      />
    </div>
  );
}
