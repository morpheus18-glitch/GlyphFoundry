import { useEffect, useRef, useState, useCallback } from 'react';
import { ViewportInfo, LODLevel } from '../utils/viewportCulling';
import type { WorkerRequest, WorkerResponse } from '../workers/cullingWorker';

interface Node {
  id: string;
  x?: number;
  y?: number;
  [key: string]: any;
}

interface Edge {
  source: string;
  target: string;
  [key: string]: any;
}

interface CullingResult {
  visibleNodes: Node[];
  visibleEdges: Edge[];
  stats: {
    total: number;
    visible: number;
    culled: number;
    lodLevel: LODLevel;
    edgesCulled: number;
    cullTimeMs?: number;
  };
}

export function useViewportCullingWorker(allNodes: Node[], allEdges: Edge[]) {
  const workerRef = useRef<Worker | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [quadTreeSize, setQuadTreeSize] = useState(0);
  const visibleNodeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/cullingWorker.ts', import.meta.url),
      { type: 'module' }
    );

    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;

      if (response.type === 'buildComplete') {
        setIsBuilding(false);
        setQuadTreeSize(response.stats.quadTreeSize);
        console.log(`[Culling Worker] Built QuadTree: ${response.stats.nodeCount} nodes in ${response.stats.buildTimeMs}ms`);
      } else if (response.type === 'error') {
        console.error('[Culling Worker] Error:', response.error);
        setIsBuilding(false);
      }
    };

    workerRef.current.addEventListener('message', handleMessage);

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current || allNodes.length === 0) return;

    setIsBuilding(true);

    const request: WorkerRequest = {
      type: 'build',
      nodes: allNodes
    };

    workerRef.current.postMessage(request);
  }, [allNodes]);

  const requestIdRef = useRef(0);
  const pendingRequestRef = useRef<number | null>(null);

  const cullToViewport = useCallback((
    viewport: ViewportInfo,
    expandMargin: number = 200
  ): Promise<CullingResult> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        resolve({
          visibleNodes: [],
          visibleEdges: [],
          stats: {
            total: 0,
            visible: 0,
            culled: 0,
            lodLevel: LODLevel.MEDIUM,
            edgesCulled: 0
          }
        });
        return;
      }

      const requestId = ++requestIdRef.current;
      pendingRequestRef.current = requestId;

      const handleResponse = (event: MessageEvent<WorkerResponse & { requestId?: number }>) => {
        const response = event.data;

        if (response.type === 'cullComplete') {
          if (response.requestId !== requestId) {
            return;
          }

          workerRef.current?.removeEventListener('message', handleResponse);

          if (pendingRequestRef.current !== requestId) {
            return;
          }

          const visibleNodeIds = new Set(response.visibleNodeIds);
          visibleNodeIdsRef.current = visibleNodeIds;

          const visibleNodes = allNodes.filter(n => visibleNodeIds.has(n.id));

          const visibleEdges = allEdges.filter(edge =>
            visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
          );

          resolve({
            visibleNodes,
            visibleEdges,
            stats: {
              ...response.stats,
              edgesCulled: allEdges.length - visibleEdges.length
            }
          });
        } else if (response.type === 'error' && response.requestId === requestId) {
          workerRef.current?.removeEventListener('message', handleResponse);
          reject(new Error(response.error));
        }
      };

      workerRef.current.addEventListener('message', handleResponse);

      const request: WorkerRequest & { requestId: number } = {
        type: 'cull',
        requestId,
        cameraX: viewport.center.x,
        cameraY: viewport.center.y,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        zoom: viewport.zoom,
        expandMargin
      };

      workerRef.current.postMessage(request);
    });
  }, [allNodes, allEdges]);

  return {
    cullToViewport,
    quadTreeSize,
    isBuilding
  };
}
