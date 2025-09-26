// src/workers/force3d.worker.ts
// Lightweight 3D force layout with spatial hashing.
// Messages: INIT, UPDATE_GRAPH, START, STOP, PIN, UNPIN → TICK (Float32Array positions)

export type WorkerInitMsg = {
  type: "INIT";
  nodes: { id: string; x?: number; y?: number; z?: number }[];
  edges: { source: string; target: string; weight?: number }[];
  params?: Partial<SimParams>;
};
export type WorkerUpdateMsg = {
  type: "UPDATE_GRAPH";
  nodes: { id: string; x?: number; y?: number; z?: number }[];
  edges: { source: string; target: string; weight?: number }[];
};
export type WorkerStartMsg = { type: "START" };
export type WorkerStopMsg  = { type: "STOP" };
export type WorkerPinMsg   = { type: "PIN"; id: string; fixed?: [number, number, number] };
export type WorkerUnpinMsg = { type: "UNPIN"; id: string };

export type WorkerMsg =
  | WorkerInitMsg
  | WorkerUpdateMsg
  | WorkerStartMsg
  | WorkerStopMsg
  | WorkerPinMsg
  | WorkerUnpinMsg;

type Node = {
  id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  fixed?: boolean;
  fx?: number; fy?: number; fz?: number;
  deg: number;
};
type Edge = { a: number; b: number; w: number };

type SimParams = {
  repulsion: number;    // negative (magnitude of repulsion)
  springK: number;      // Hooke constant
  restLength: number;   // spring rest length
  gravity: number;      // pull to origin
  damping: number;      // velocity damping
  timeStep: number;     // dt
  cellSize: number;     // spatial hash cell
  frameHz: number;      // frame throttling
};

const DEFAULTS: SimParams = {
  repulsion: -1600,
  springK: 0.03,
  restLength: 56,
  gravity: 0.0018,
  damping: 0.9,
  timeStep: 1 / 60,
  cellSize: 110,
  frameHz: 30,
};

let params: SimParams = { ...DEFAULTS };

let nodes: Node[] = [];
let edges: Edge[] = [];
let indexById = new Map<string, number>();

let running = false;
let lastFrame = 0;

function randOnSphere(r = 420): [number, number, number] {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  ];
}

function buildNodes(list: WorkerInitMsg["nodes"]) {
  indexById.clear();
  nodes = list.map((n, i) => {
    const [rx, ry, rz] = randOnSphere();
    const x = Number.isFinite(n.x!) ? n.x! : rx;
    const y = Number.isFinite(n.y!) ? n.y! : ry;
    const z = Number.isFinite(n.z!) ? n.z! : rz;
    indexById.set(n.id, i);
    return { id: n.id, x, y, z, vx: 0, vy: 0, vz: 0, deg: 0 };
  });
}

function buildEdges(list: WorkerInitMsg["edges"]) {
  edges = [];
  nodes.forEach(n => (n.deg = 0));
  for (const e of list) {
    const a = indexById.get(e.source);
    const b = indexById.get(e.target);
    if (a === undefined || b === undefined || a === b) continue;
    edges.push({ a, b, w: Math.max(0.2, e.weight ?? 1) });
    nodes[a].deg++; nodes[b].deg++;
  }
}

const cellKey = (x: number, y: number, z: number, s: number) =>
  `${Math.floor(x / s)},${Math.floor(y / s)},${Math.floor(z / s)}`;

function step() {
  const { repulsion, springK, restLength, gravity, damping, timeStep, cellSize } = params;

  // spatial hash
  const grid = new Map<string, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const k = cellKey(n.x, n.y, n.z, cellSize);
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(i);
  }

  // repulsion + gravity
  for (let i = 0; i < nodes.length; i++) {
    const ni = nodes[i];
    let fx = 0, fy = 0, fz = 0;

    const ci = Math.floor(ni.x / cellSize);
    const cj = Math.floor(ni.y / cellSize);
    const ck = Math.floor(ni.z / cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const arr = grid.get(`${ci + dx},${cj + dy},${ck + dz}`);
          if (!arr) continue;
          for (const j of arr) {
            if (j === i) continue;
            const nj = nodes[j];
            let dxv = ni.x - nj.x;
            let dyv = ni.y - nj.y;
            let dzv = ni.z - nj.z;
            const dist2 = dxv * dxv + dyv * dyv + dzv * dzv + 1e-3;
            const inv = 1 / Math.sqrt(dist2);
            const f = repulsion / dist2;
            dxv *= inv; dyv *= inv; dzv *= inv;
            fx += dxv * f; fy += dyv * f; fz += dzv * f;
          }
        }
      }
    }

    // gravity toward origin
    fx += -ni.x * gravity;
    fy += -ni.y * gravity;
    fz += -ni.z * gravity;

    if (!ni.fixed) {
      ni.vx = (ni.vx + fx * timeStep) * damping;
      ni.vy = (ni.vy + fy * timeStep) * damping;
      ni.vz = (ni.vz + fz * timeStep) * damping;
    }
  }

  // springs
  for (const e of edges) {
    const a = nodes[e.a];
    const b = nodes[e.b];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
    const ext = d - restLength;
    const f = springK * ext * e.w;
    const nx = dx / d, ny = dy / d, nz = dz / d;

    if (!a.fixed) { a.vx += nx * f * 0.5; a.vy += ny * f * 0.5; a.vz += nz * f * 0.5; }
    if (!b.fixed) { b.vx -= nx * f * 0.5; b.vy -= ny * 0.5 * f; b.vz -= nz * 0.5 * f; }
  }

  // integrate
  for (const n of nodes) {
    if (n.fixed) {
      if (n.fx !== undefined) { n.x = n.fx!; n.y = n.fy!; n.z = n.fz!; }
      continue;
    }
    n.x += n.vx; n.y += n.vy; n.z += n.vz;
  }
}

function sendFrame(now: number) {
  const ms = 1000 / params.frameHz;
  if (now - lastFrame < ms) return;
  lastFrame = now;
  const buf = new Float32Array(nodes.length * 3);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    buf[i * 3 + 0] = n.x;
    buf[i * 3 + 1] = n.y;
    buf[i * 3 + 2] = n.z;
  }
  (postMessage as any)({ type: "TICK", positions: buf, ids: nodes.map(n => n.id) }, [buf.buffer]);
}

function loop() {
  if (!running) return;
  step();
  sendFrame(performance.now());
  setTimeout(loop, 0); // cooperative
}

// messaging
self.onmessage = (ev: MessageEvent<WorkerMsg>) => {
  const msg = ev.data;
  switch (msg.type) {
    case "INIT":
      params = { ...DEFAULTS, ...(msg.params || {}) };
      buildNodes(msg.nodes);
      buildEdges(msg.edges);
      break;
    case "UPDATE_GRAPH":
      buildNodes(msg.nodes);
      buildEdges(msg.edges);
      break;
    case "START":
      if (!running) { running = true; loop(); }
      break;
    case "STOP":
      running = false;
      break;
    case "PIN": {
      const i = indexById.get(msg.id);
      if (i !== undefined) {
        const n = nodes[i];
        n.fixed = true;
        if (msg.fixed) { n.fx = msg.fixed[0]; n.fy = msg.fixed[1]; n.fz = msg.fixed[2]; }
      }
      break;
    }
    case "UNPIN": {
      const i = indexById.get(msg.id);
      if (i !== undefined) {
        const n = nodes[i];
        n.fixed = false;
        n.fx = n.fy = n.fz = undefined;
      }
      break;
    }
  }
};