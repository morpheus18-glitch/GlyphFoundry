import { QuadTree, calculateViewportBounds, expandBounds, getLODLevel, LOD_CONFIGS, LODLevel } from '../utils/viewportCulling';

interface Node {
  id: string;
  x?: number;
  y?: number;
  importance?: number;
  degree?: number;
  [key: string]: any;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BuildRequest {
  type: 'build';
  nodes: Node[];
}

export interface CullRequest {
  type: 'cull';
  requestId?: number;
  cameraX: number;
  cameraY: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom: number;
  expandMargin?: number;
}

export type WorkerRequest = BuildRequest | CullRequest;

export interface BuildResponse {
  type: 'buildComplete';
  stats: {
    buildTimeMs: number;
    nodeCount: number;
    quadTreeSize: number;
  };
}

export interface CullResponse {
  type: 'cullComplete';
  requestId?: number;
  visibleNodeIds: string[];
  stats: {
    total: number;
    visible: number;
    culled: number;
    lodLevel: LODLevel;
    cullTimeMs: number;
  };
}

export interface ErrorResponse {
  type: 'error';
  requestId?: number;
  error: string;
}

export type WorkerResponse = BuildResponse | CullResponse | ErrorResponse;

let quadTree: QuadTree<Node> | null = null;
let allNodes: Node[] = [];

function buildSpatialIndex(nodes: Node[]): QuadTree<Node> | null {
  if (nodes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const node of nodes) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
  const bounds: BoundingBox = {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding
  };

  const tree = new QuadTree<Node>(bounds, 16, 12);

  for (const node of nodes) {
    tree.insert(
      { x: node.x ?? 0, y: node.y ?? 0 },
      node
    );
  }

  return tree;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  const requestId = request.type === 'cull' ? request.requestId : undefined;

  try {
    if (request.type === 'build') {
      const startTime = performance.now();
      
      allNodes = request.nodes;
      quadTree = buildSpatialIndex(request.nodes);
      
      const buildTime = performance.now() - startTime;

      const response: BuildResponse = {
        type: 'buildComplete',
        stats: {
          buildTimeMs: Math.round(buildTime * 100) / 100,
          nodeCount: request.nodes.length,
          quadTreeSize: quadTree?.size() ?? 0
        }
      };

      self.postMessage(response);

    } else if (request.type === 'cull') {
      if (!quadTree) {
        throw new Error('QuadTree not initialized. Call build first.');
      }

      const startTime = performance.now();
      const { requestId, cameraX, cameraY, viewportWidth, viewportHeight, zoom, expandMargin = 200 } = request;

      const viewportBounds = calculateViewportBounds(
        { x: cameraX, y: cameraY },
        viewportWidth,
        viewportHeight,
        zoom
      );

      const lodLevel = getLODLevel(zoom);
      const lodConfig = LOD_CONFIGS[lodLevel];

      const expandedBounds = expandBounds(viewportBounds, expandMargin);

      const visibleNodeData = quadTree.query(expandedBounds);
      
      const sortedNodes = visibleNodeData
        .map(item => item.data)
        .sort((a, b) => {
          const importanceA = a.importance ?? a.degree ?? 0;
          const importanceB = b.importance ?? b.degree ?? 0;
          return importanceB - importanceA;
        });

      const visibleNodes = sortedNodes.slice(0, lodConfig.maxNodes);
      const visibleNodeIds = visibleNodes.map(n => n.id);

      const cullTime = performance.now() - startTime;

      const response: CullResponse = {
        type: 'cullComplete',
        requestId,
        visibleNodeIds,
        stats: {
          total: allNodes.length,
          visible: visibleNodeIds.length,
          culled: allNodes.length - visibleNodeIds.length,
          lodLevel,
          cullTimeMs: Math.round(cullTime * 100) / 100
        }
      };

      self.postMessage(response);
    }

  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    self.postMessage(response);
  }
};
