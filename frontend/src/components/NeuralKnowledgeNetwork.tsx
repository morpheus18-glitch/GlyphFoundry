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

  // Worker + live positions
  const workerRef = useRef<Worker | null>(null);
  const posRef = useRef<Float32Array | null>(null);
  const idsRef = useRef<string[] | null>(null);

  // Fetch/props + boot worker
  useEffect(() => {
    let active = true;

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

        // worker
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
  }, [propNodes, propEdges]);

  const pushRecent = useCallback((n: ApiNode) => {
    setRecent((r) => [n, ...r.filter((x) => x.id !== n.id)].slice(0, 10));
  }, []);

  const handleSelect = useCallback((n: ApiNode) => {
    setSelected(n);
    pushRecent(n);
    workerRef.current?.postMessage({ type: "PIN", id: n.id });
  }, [pushRecent]);

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

  return (
    <div className="relative w-full h-full min-h-[480px] bg-black text-white">
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
        {loading ? <span className="text-sky-300">loading…</span> : <>Nodes: {graph.nodes.length} · Edges: {graph.edges.length}</>}
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
              onClick={() => {
                if (selected && workerRef.current) workerRef.current.postMessage({ type: "UNPIN", id: selected.id });
                setSelected(null);
              }}
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
    </div>
  );
}
