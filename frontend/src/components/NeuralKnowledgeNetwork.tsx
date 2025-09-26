/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import { EffectComposer, Bloom, DepthOfField, SMAA } from "@react-three/postprocessing";

// --- Worker import (Vite) ---
import ForceWorkerURL from "../workers/force3d.worker.ts?worker";

// ---- Types ----
type ApiNode = {
  id: string;
  kind?: string;
  label?: string;
  summary?: string;
  degree?: number;
  ts?: number;
  x?: number;
  y?: number;
  z?: number;
  size?: number;
  importance?: number;
};

type ApiEdge = { source: string; target: string; rel?: string; weight?: number; ts?: number };

type GraphPayload = {
  nodes: ApiNode[];
  edges: ApiEdge[];
  stats?: { node_count: number; edge_count: number; window_minutes: number };
};

// ---- Config / Colors ----
const BASE = import.meta.env.VITE_GRAPH_BASE || "/graph3d";
const TOKEN = import.meta.env.VITE_GRAPH_TOKEN || "";

const COLOR_BG = new THREE.Color("#0b0e13");
const COLOR_NODE = new THREE.Color("#4A90E2");
const COLOR_NODE_IMPORTANT = new THREE.Color("#B19CD9");
const COLOR_EDGE = new THREE.Color("#2b313d");
const MAX_NODES_FOR_LINES = 3000;
const FAR_LOD_DISTANCE = 900;

const SOFTWARE_RENDERER_REGEX = /swiftshader|software|llvmpipe/i;

function detectHardwareAcceleration(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const attributes: WebGLContextAttributes = {
      antialias: false,
      alpha: false,
      depth: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
    };
    const gl =
      (canvas.getContext("webgl2", attributes) as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl", attributes) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl", attributes) as WebGLRenderingContext | null);
    if (!gl) return false;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string | null;
      if (renderer && SOFTWARE_RENDERER_REGEX.test(renderer)) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return false;
      }
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// ---- Helpers ----
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

function makeSampleGraph(n = 600, e = 1200): GraphPayload {
  const nodes: ApiNode[] = [];
  const edges: ApiEdge[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 420 + 220 * Math.random();
    nodes.push({
      id: `node-${i}`,
      label: `Node ${i}`,
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
      degree: 1 + Math.floor(6 * Math.random()),
      importance: Math.random(),
    });
  }
  for (let i = 0; i < e; i++) {
    const a = Math.floor(Math.random() * n);
    const b = Math.floor(Math.random() * n);
    if (a !== b) edges.push({ source: nodes[a].id, target: nodes[b].id, weight: Math.random() });
  }
  return { nodes, edges, stats: { node_count: n, edge_count: e, window_minutes: 60 } };
}

function normalizePositions(g: GraphPayload): GraphPayload {
  const nodes = g.nodes.map((n) => {
    if ([n.x, n.y, n.z].every((v) => typeof v === "number")) return n;
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 420 + 200 * Math.random();
    return {
      ...n,
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
    };
  });
  return { ...g, nodes };
}

// ---- Camera focus helper ----
function useCinematicFocus() {
  const { camera } = useThree();
  const controls = useRef<any>(null);

  const setControls = useCallback((c: any) => (controls.current = c), []);

  const focusOn = useCallback((p: THREE.Vector3, distance = 120) => {
    const startPos = camera.position.clone();
    const startTgt = controls.current?.target.clone() || new THREE.Vector3();
    const dir = p.clone().sub(startTgt).normalize();
    const endTgt = p.clone();
    const endPos = p.clone().add(dir.multiplyScalar(distance));
    let t = 0;
    const dur = 0.8;
    function animate() {
      t += 1 / 60 / dur;
      const k = 1 - Math.pow(1 - Math.min(1, t), 3);
      camera.position.lerpVectors(startPos, endPos, k);
      controls.current?.target.lerpVectors(startTgt, endTgt, k);
      if (k < 1) requestAnimationFrame(animate);
    }
    animate();
  }, [camera]);

  return { setControls, focusOn };
}

// ---- Instanced nodes (reads worker positions) ----
function InstancedNodes({
  nodes,
  onSelect,
  focusOn,
  worldScale = 1.6,
  positions,
  reduceMotion,
}: {
  nodes: ApiNode[];
  onSelect: (n: ApiNode) => void;
  focusOn: (p: THREE.Vector3, d?: number) => void;
  worldScale?: number;
  positions?: Float32Array | null;
  reduceMotion?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // per-instance color buffer
  const colorArray = useMemo(() => {
    const colors = new Float32Array(nodes.length * 3);
    for (let i = 0; i < nodes.length; i++) {
      const imp = nodes[i].importance ?? Math.min(1, (nodes[i].degree ?? 1) / 8);
      const c = imp > 0.75 ? COLOR_NODE_IMPORTANT : COLOR_NODE;
      colors[i * 3 + 0] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return colors;
  }, [nodes]);

  const tempMatrix = new THREE.Matrix4();

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const dummy = new THREE.Object3D();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const x = positions ? positions[i * 3 + 0] : (n.x ?? 0);
      const y = positions ? positions[i * 3 + 1] : (n.y ?? 0);
      const z = positions ? positions[i * 3 + 2] : (n.z ?? 0);
      dummy.position.set(x, y, z);

      const base = 0.8 + (n.importance ?? Math.min(1, (n.degree ?? 1) / 8)) * 1.6;
      const pulse = reduceMotion ? 1 : 1 + 0.03 * Math.sin(t * 2 + i * 0.3);
      dummy.scale.setScalar(base * pulse * worldScale);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const onClick = useCallback((e: any) => {
    e.stopPropagation();
    const id = e.instanceId as number;
    if (id === undefined || !meshRef.current) return;
    let pos: THREE.Vector3;
    if (positions) {
      pos = new THREE.Vector3(positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]);
    } else {
      meshRef.current.getMatrixAt(id, tempMatrix);
      pos = new THREE.Vector3().setFromMatrixPosition(tempMatrix);
    }
    onSelect(nodes[id]);
    focusOn(pos, 140);
  }, [positions, nodes, onSelect, focusOn]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined as any, undefined as any, nodes.length]}
      onClick={onClick}
      castShadow
      receiveShadow
    >
      <icosahedronGeometry args={[1, 2]} />
      <meshPhysicalMaterial
        metalness={0.4}
        roughness={0.35}
        clearcoat={0.6}
        clearcoatRoughness={0.3}
        envMapIntensity={1.2}
        vertexColors
      />
      <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
    </instancedMesh>
  );
}

// ---- Edge lines ----
function EdgeLines({ nodesById, edges, opacity = 0.25 }: {
  nodesById: Map<string, ApiNode>;
  edges: ApiEdge[];
  opacity?: number;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(edges.length * 2 * 3);
    let i = 0;
    for (const e of edges) {
      const a = nodesById.get(e.source);
      const b = nodesById.get(e.target);
      if (!a || !b) continue;
      positions[i++] = a.x ?? 0; positions[i++] = a.y ?? 0; positions[i++] = a.z ?? 0;
      positions[i++] = b.x ?? 0; positions[i++] = b.y ?? 0; positions[i++] = b.z ?? 0;
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [edges, nodesById]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={COLOR_EDGE} transparent opacity={opacity} />
    </lineSegments>
  );
}

// ---- LOD points (far) ----
function FarPoints({ nodes }: { nodes: ApiNode[] }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(nodes.length * 3);
    for (let i = 0; i < nodes.length; i++) {
      arr[i * 3 + 0] = nodes[i].x ?? 0;
      arr[i * 3 + 1] = nodes[i].y ?? 0;
      arr[i * 3 + 2] = nodes[i].z ?? 0;
    }
    return arr;
  }, [nodes]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={2} sizeAttenuation color={COLOR_NODE} transparent opacity={0.8} />
    </points>
  );
}

// ---- Scene root ----
function GraphScene({
  graph,
  onSelect,
  positions,
}: {
  graph: GraphPayload;
  onSelect: (n: ApiNode) => void;
  positions?: Float32Array | null;
}) {
  const { camera } = useThree();
  const { setControls, focusOn } = useCinematicFocus();
  const [distance, setDistance] = useState(600);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    camera.position.set(0, 0, 600);
  }, [camera]);

  useEffect(() => {
    if (!graph.nodes.length) return;
    const bb = new THREE.Box3();
    graph.nodes.forEach((n) => bb.expandByPoint(new THREE.Vector3(n.x ?? 0, n.y ?? 0, n.z ?? 0)));
    const size = new THREE.Vector3(); bb.getSize(size);
    const center = new THREE.Vector3(); bb.getCenter(center);
    camera.position.set(center.x, center.y, Math.max(size.length() * 0.8, 420));
    focusOn(center, Math.max(size.length() * 0.65, 260));
  }, [graph.nodes, camera, focusOn]);

  useFrame(() => setDistance(camera.position.length()));
  const nodesById = useMemo(() => new Map(graph.nodes.map(n => [n.id, n] as const)), [graph.nodes]);
  const usePointsLOD = distance > FAR_LOD_DISTANCE;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight intensity={0.9} position={[600, 400, 300]} castShadow shadow-mapSize={[2048, 2048]} />
      <Environment preset="night" background={false} />

      {usePointsLOD ? (
        <FarPoints nodes={graph.nodes} />
      ) : (
        <InstancedNodes
          nodes={graph.nodes}
          onSelect={onSelect}
          focusOn={focusOn}
          worldScale={1.6}
          reduceMotion={reduceMotion}
          positions={positions}
        />
      )}

      {graph.nodes.length <= MAX_NODES_FOR_LINES && graph.edges.length > 0 && (
        <EdgeLines nodesById={nodesById} edges={graph.edges} opacity={usePointsLOD ? 0.18 : 0.28} />
      )}
      {usePointsLOD ? (
        <EffectComposer multisampling={0} enableNormalPass>
          <SMAA />
          <Bloom intensity={0.8} luminanceThreshold={0.25} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0} enableNormalPass>
          <SMAA />
          <Bloom intensity={0.8} luminanceThreshold={0.25} luminanceSmoothing={0.3} mipmapBlur />
          <DepthOfField focusDistance={0.02} focalLength={0.02} bokehScale={1.2} height={480} />
        </EffectComposer>
      )}

      <OrbitControls
        ref={setControls as any}
        enableDamping
        dampingFactor={0.05}
        minDistance={120}
        maxDistance={2400}
        rotateSpeed={0.9}
        zoomSpeed={0.9}
        panSpeed={0.8}
      />
    </>
  );
}

function FallbackGraphExperience({
  graph,
  loading,
  q,
  setQ,
  searchResults,
  onSelect,
  onClearSelection,
  selected,
  recent,
  onRecentSelect,
  renderModeLabel,
}: {
  graph: GraphPayload;
  loading: boolean;
  q: string;
  setQ: (value: string) => void;
  searchResults: ApiNode[];
  onSelect: (n: ApiNode) => void;
  onClearSelection: () => void;
  selected: ApiNode | null;
  recent: ApiNode[];
  onRecentSelect: (n: ApiNode) => void;
  renderModeLabel: string;
}) {
  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n] as const)), [graph.nodes]);
  const importantNodes = useMemo(() => {
    const scored = graph.nodes.map((n) => ({
      node: n,
      score:
        (typeof n.importance === "number" ? n.importance : 0) * 2 +
        (typeof n.degree === "number" ? n.degree : 0),
    }));
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 400)
      .map((entry) => entry.node);
  }, [graph.nodes]);

  const neighbors = useMemo(() => {
    if (!selected) return [] as ApiNode[];
    const linked = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.source === selected.id) linked.add(edge.target);
      else if (edge.target === selected.id) linked.add(edge.source);
    }
    return Array.from(linked)
      .map((id) => nodesById.get(id))
      .filter((n): n is ApiNode => Boolean(n))
      .sort((a, b) => {
        const scoreA = (a.importance ?? 0) + (a.degree ?? 0) / 10;
        const scoreB = (b.importance ?? 0) + (b.degree ?? 0) / 10;
        return scoreB - scoreA;
      })
      .slice(0, 40);
  }, [graph.edges, nodesById, selected]);

  const listToShow = q.trim() ? searchResults : importantNodes;
  const showNoResults = q.trim().length > 0 && searchResults.length === 0;

  return (
    <div className="flex h-full w-full flex-col bg-[#05070d] text-neutral-100">
      <div className="border-b border-[rgba(255,255,255,.08)] bg-[rgba(6,10,18,.85)] px-5 py-4 shadow-md">
        <div className="text-xs uppercase tracking-wide text-neutral-400">{renderModeLabel}</div>
        <div className="mt-1 text-lg font-semibold text-neutral-100">Knowledge explorer (simplified)</div>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Hardware acceleration is unavailable, so the cinematic renderer switched to a CPU-friendly backup mode. You can still
          browse the knowledge graph using the tools below.
        </p>
        <div className="mt-2 text-xs text-neutral-500">
          {loading
            ? "Loading graph data…"
            : `Nodes: ${graph.nodes.length} · Edges: ${graph.edges.length}`}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-neutral-400" htmlFor="nkn-fallback-search">
            Search network
          </label>
          <input
            id="nkn-fallback-search"
            className="w-full rounded-lg border border-[rgba(255,255,255,.12)] bg-[rgba(12,18,28,.9)] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Search nodes by label, id, or summary…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {showNoResults && (
          <div className="rounded-lg border border-[rgba(255,255,255,.08)] bg-[rgba(12,18,28,.85)] px-4 py-6 text-sm text-neutral-400">
            No matches found. Try a different query or clear the search to explore highlighted nodes.
          </div>
        )}

        {!showNoResults && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden md:flex-row">
            <div className="flex-1 overflow-hidden rounded-lg border border-[rgba(255,255,255,.08)] bg-[rgba(12,18,28,.78)]">
              <div className="sticky top-0 z-10 border-b border-[rgba(255,255,255,.06)] bg-[rgba(12,18,28,.92)] px-4 py-3 text-sm font-semibold text-neutral-100">
                {q.trim() ? "Search results" : "Highlighted nodes"}
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  {listToShow.length} item{listToShow.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="max-h-full overflow-auto px-2 py-3">
                {listToShow.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onSelect(n)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[rgba(255,255,255,.05)] ${
                      selected?.id === n.id ? "bg-[rgba(56,132,255,.12)]" : ""
                    }`}
                  >
                    <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${selected?.id === n.id ? "bg-sky-400" : "bg-neutral-500"}`} />
                    <div className="min-w-0">
                      <div className="truncate text-sm text-neutral-100">{n.label || n.id}</div>
                      <div className="truncate text-xs text-neutral-400">{n.summary || n.id}</div>
                    </div>
                    {(typeof n.degree === "number" || typeof n.importance === "number") && (
                      <div className="ml-auto shrink-0 rounded border border-[rgba(255,255,255,.08)] px-2 py-0.5 text-[11px] text-neutral-400">
                        {typeof n.degree === "number" ? `deg ${n.degree}` : ""}
                        {typeof n.importance === "number" ? `${typeof n.degree === "number" ? " · " : ""}imp ${n.importance.toFixed(2)}` : ""}
                      </div>
                    )}
                  </button>
                ))}
                {listToShow.length === 0 && !loading && (
                  <div className="px-3 py-4 text-sm text-neutral-400">No nodes available.</div>
                )}
              </div>
            </div>

            <div className="md:w-80 md:flex-none">
              {selected ? (
                <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[rgba(255,255,255,.08)] bg-[rgba(12,18,28,.78)]">
                  <div className="flex items-start gap-3 border-b border-[rgba(255,255,255,.06)] bg-[rgba(12,18,28,.92)] px-4 py-3">
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-neutral-100">{selected.label || selected.id}</div>
                      <div className="truncate text-xs text-neutral-400">{selected.summary || selected.id}</div>
                    </div>
                    <button
                      className="ml-auto shrink-0 rounded px-2 py-0.5 text-xs text-neutral-400 transition hover:text-neutral-100"
                      onClick={onClearSelection}
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 space-y-3 overflow-auto px-4 py-3 text-xs text-neutral-300">
                    {selected.kind && (
                      <div>
                        <span className="text-neutral-500">Type:</span> {selected.kind}
                      </div>
                    )}
                    {typeof selected.degree === "number" && (
                      <div>
                        <span className="text-neutral-500">Degree:</span> {selected.degree}
                      </div>
                    )}
                    <div className="pt-2 text-[11px] uppercase tracking-wide text-neutral-500">Connected nodes</div>
                    {neighbors.length === 0 && (
                      <div className="text-neutral-500">No neighbors found in current dataset.</div>
                    )}
                    {neighbors.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => onSelect(n)}
                        className="flex w-full items-start gap-2 rounded border border-[rgba(255,255,255,.06)] bg-[rgba(18,24,35,.85)] px-2 py-1.5 text-left text-[13px] text-neutral-200 transition hover:border-sky-500 hover:text-neutral-50"
                      >
                        <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                        <div className="min-w-0">
                          <div className="truncate">{n.label || n.id}</div>
                          <div className="truncate text-[11px] text-neutral-500">{n.summary || n.id}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-start justify-center rounded-lg border border-dashed border-[rgba(255,255,255,.1)] bg-[rgba(12,18,28,.6)] px-4 py-6 text-sm text-neutral-400">
                  Select a node to view details and related entities.
                </div>
              )}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="rounded-lg border border-[rgba(255,255,255,.08)] bg-[rgba(12,18,28,.78)] px-4 py-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Recent selections</div>
            <div className="flex flex-wrap gap-2">
              {recent.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onRecentSelect(n)}
                  className="truncate rounded-lg border border-[rgba(255,255,255,.12)] bg-[rgba(18,24,35,.85)] px-2 py-1 text-xs text-neutral-200 transition hover:border-sky-500 hover:text-neutral-50"
                  title={n.label || n.id}
                >
                  {(n.label || n.id).slice(0, 32)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main exported component (includes worker wiring + search HUD) ----
export default function NeuralKnowledgeNetwork({
  nodes: propNodes,
  edges: propEdges,
}: {
  nodes?: ApiNode[];
  edges?: ApiEdge[];
}) {
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [], stats: { node_count: 0, edge_count: 0, window_minutes: 60 } });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApiNode | null>(null);
  const [recent, setRecent] = useState<ApiNode[]>([]);
  const [q, setQ] = useState("");
  const [gpuInfo, setGpuInfo] = useState<{ checked: boolean; available: boolean }>({ checked: false, available: true });

  // Worker + live positions
  const workerRef = useRef<Worker | null>(null);
  const posRef = useRef<Float32Array | null>(null);
  const idsRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setGpuInfo({ checked: true, available: true });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const available = detectHardwareAcceleration();
      if (!cancelled) setGpuInfo({ checked: true, available });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Fetch/props + boot worker
  useEffect(() => {
    let active = true;
    if (!gpuInfo.checked) return () => {
      active = false;
    };

    async function boot() {
      try {
        setLoading(true);

        // acquire data
        let data: GraphPayload | null = null;
        if (propNodes && propEdges) {
          data = normalizePositions({ nodes: propNodes, edges: propEdges });
        } else {
          const res = await fetch(`${BASE}/data?window_minutes=4320&limit_nodes=1500&limit_edges=5000`,
            { headers: authHeaders() });
          const raw = (await res.json().catch(() => ({}))) as any;
          data = {
            nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
            edges: Array.isArray(raw.edges) ? raw.edges : [],
            stats: raw.stats || { node_count: 0, edge_count: 0, window_minutes: 60 },
          };
          if (data.nodes.length === 0) data = makeSampleGraph();
          data = normalizePositions(data);
        }
        if (!active || !data) return;

        setGraph(data);

        if (gpuInfo.available) {
          const w = new ForceWorkerURL();
          workerRef.current = w;

          w.onmessage = (ev: MessageEvent<any>) => {
            if (!active) return;
            const { type, positions, ids } = ev.data || {};
            if (type === "TICK" && positions) {
              posRef.current = positions;
              if (ids) idsRef.current = ids;
            }
          };

          w.postMessage({
            type: "INIT",
            nodes: data.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
            edges: data.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
            params: {
              repulsion: -1600,
              restLength: 56,
              springK: 0.03,
              gravity: 0.0018,
              cellSize: 110,
              frameHz: 30,
            },
          });
          w.postMessage({ type: "START" });
        } else {
          workerRef.current = null;
          posRef.current = null;
          idsRef.current = null;
        }
      } catch {
        if (active) setGraph(normalizePositions(makeSampleGraph()));
      } finally {
        if (active) setLoading(false);
      }
    }

    boot();

    // cleanup
    return () => {
      active = false;
      if (workerRef.current) {
        workerRef.current.postMessage({ type: "STOP" });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      posRef.current = null;
      idsRef.current = null;
    };
  }, [propNodes, propEdges, gpuInfo]);

  const pushRecent = useCallback((n: ApiNode) => {
    setRecent((r) => [n, ...r.filter((x) => x.id !== n.id)].slice(0, 10));
  }, []);

  const handleSelect = useCallback((n: ApiNode) => {
    setSelected(n);
    pushRecent(n);
    workerRef.current?.postMessage({ type: "PIN", id: n.id });
  }, [pushRecent]);

  const clearSelection = useCallback(() => {
    if (selected && workerRef.current) {
      workerRef.current.postMessage({ type: "UNPIN", id: selected.id });
    }
    setSelected(null);
  }, [selected]);

  const searchResults = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.trim().toLowerCase();
    const score = (n: ApiNode) => {
      const label = (n.label || n.id).toLowerCase();
      let s = 0;
      if (label.includes(needle)) s += 2;
      if ((n.summary || "").toLowerCase().includes(needle)) s += 1;
      s += Math.min(1, (n.degree ?? 0) / 8);
      s += (n.importance ?? 0);
      return s;
    };
    return [...graph.nodes]
      .filter((n) => (n.label || n.id).toLowerCase().includes(needle) || (n.summary || "").toLowerCase().includes(needle))
      .map((n) => ({ n, s: score(n) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map(({ n }) => n);
  }, [q, graph.nodes]);

  const renderModeLabel = !gpuInfo.checked
    ? "Detecting rendering capabilities"
    : gpuInfo.available
      ? "Cinematic renderer (GPU)"
      : "Backup renderer (CPU)";

  return (
    <div className="relative w-full h-full min-h-[480px] bg-black text-white">
      {gpuInfo.available ? (
        <>
          <Canvas
            dpr={[1, 2]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            onPointerMissed={() => {}}
            camera={{ fov: 60, near: 0.1, far: 5000, position: [0, 0, 600] }}
          >
            <color attach="background" args={[COLOR_BG]} />
            <Suspense fallback={<Html center style={{ color: "#9aa6b2" }}>Loading scene…</Html>}>
              <GraphScene
                graph={graph}
                onSelect={handleSelect}
                positions={posRef.current}
              />
            </Suspense>
          </Canvas>

          {/* Status HUD */}
          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-[rgba(255,255,255,.08)] bg-[rgba(15,19,26,.8)] px-3 py-2 text-xs text-neutral-300 backdrop-blur">
            {loading ? (
              <span className="text-sky-300">loading…</span>
            ) : (
              <>
                Nodes: {graph.nodes.length} · Edges: {graph.edges.length}
                <span className="ml-2 text-[11px] uppercase tracking-wide text-neutral-500">{renderModeLabel}</span>
              </>
            )}
          </div>

          {/* Search HUD */}
          <div className="absolute left-1/2 top-3 z-20 w-[min(720px,90vw)] -translate-x-1/2">
            <div className="rounded-xl border border-[rgba(255,255,255,.08)] bg-[rgba(15,19,26,.7)] backdrop-blur">
              <input
                className="w-full bg-transparent px-4 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
                placeholder="Search nodes by label, id, or summary…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && searchResults.length > 0 && (
                <div className="max-h-64 overflow-auto border-t border-[rgba(255,255,255,.06)]">
                  {searchResults.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { setSelected(n); pushRecent(n); setQ(""); }}
                      className="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-[rgba(255,255,255,.04)]"
                    >
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-neutral-100">{n.label || n.id}</div>
                        <div className="truncate text-xs text-neutral-400">{n.summary || n.id}</div>
                      </div>
                      {typeof n.degree === "number" && (
                        <div className="ml-auto shrink-0 rounded border border-[rgba(255,255,255,.08)] px-1.5 py-0.5 text-[10px] text-neutral-400">
                          deg {n.degree}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {q && searchResults.length === 0 && (
                <div className="border-t border-[rgba(255,255,255,.06)] px-4 py-2.5 text-xs text-neutral-400">No matches</div>
              )}
            </div>
          </div>

          {/* Selected details */}
          {selected && (
            <div className="absolute right-3 top-3 z-20 w-[min(360px,95vw)] rounded-xl border border-[rgba(255,255,255,.08)] bg-[rgba(15,19,26,.8)] p-3 text-sm backdrop-blur">
              <div className="mb-2 flex items-start gap-2">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                <div className="font-semibold">{selected.label || selected.id}</div>
                <button
                  className="ml-auto rounded px-2 py-0.5 text-xs text-neutral-400 hover:text-neutral-100"
                  onClick={clearSelection}
                >
                  Close
                </button>
              </div>
              <div className="space-y-1 text-xs text-neutral-300">
                <div><span className="text-neutral-500">ID:</span> {selected.id}</div>
                {selected.kind && <div><span className="text-neutral-500">Type:</span> {selected.kind}</div>}
                {typeof selected.degree === "number" && <div><span className="text-neutral-500">Degree:</span> {selected.degree}</div>}
                {selected.summary && <div className="text-neutral-400">{selected.summary}</div>}
              </div>
              <div className="mt-3 border-t border-[rgba(255,255,255,.06)] pt-2">
                <button
                  className="rounded-lg border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.03)] px-3 py-1 text-xs text-neutral-200 hover:bg-[rgba(255,255,255,.06)]"
                  onClick={() => {
                    // TODO: call your backend to expand neighbors, then:
                    // workerRef.current?.postMessage({ type: "UPDATE_GRAPH", nodes, edges })
                  }}
                >
                  Expand knowledge
                </button>
              </div>
            </div>
          )}

          {/* Recent selections */}
          {recent.length > 0 && (
            <div className="absolute bottom-3 left-3 z-20 w-[min(460px,95vw)] rounded-xl border border-[rgba(255,255,255,.08)] bg-[rgba(15,19,26,.8)] p-2 backdrop-blur">
              <div className="mb-1 px-1 text-xs text-neutral-400">Recent</div>
              <div className="flex flex-wrap gap-2">
                {recent.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelected(n)}
                    className="truncate rounded-lg border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.03)] px-2 py-1 text-xs text-neutral-200 hover:bg-[rgba(255,255,255,.06)]"
                    title={n.label || n.id}
                  >
                    {(n.label || n.id).slice(0, 28)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls legend */}
          <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-lg border border-[rgba(255,255,255,.08)] bg-[rgba(15,19,26,.8)] px-3 py-2 text-xs text-neutral-400 backdrop-blur">
            Left-drag: rotate · Right-drag: pan · Wheel: zoom · Click node: focus
          </div>
        </>
      ) : (
        <FallbackGraphExperience
          graph={graph}
          loading={loading}
          q={q}
          setQ={setQ}
          searchResults={searchResults}
          onSelect={handleSelect}
          onClearSelection={clearSelection}
          selected={selected}
          recent={recent}
          onRecentSelect={(n) => setSelected(n)}
          renderModeLabel={renderModeLabel}
        />
      )}
    </div>
  );
}
