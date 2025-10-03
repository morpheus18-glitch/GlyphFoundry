import { useMemo, useCallback, useRef } from 'react';
import {
  QuadTree,
  calculateViewportBounds,
  expandBounds,
  getLODLevel,
  LOD_CONFIGS,
  LODLevel,
  ViewportInfo
} from '../utils/viewportCulling';

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
  };
}

export function useViewportCulling(allNodes: Node[], allEdges: Edge[]) {
  const quadTreeRef = useRef<QuadTree<Node> | null>(null);
  
  // Build QuadTree from nodes
  const buildSpatialIndex = useCallback((nodes: Node[]) => {
    if (nodes.length === 0) return null;

    // Calculate bounds from all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    // Add padding
    const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
    const bounds = {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };

    const quadTree = new QuadTree<Node>(bounds, 16, 12);

    for (const node of nodes) {
      quadTree.insert(
        { x: node.x ?? 0, y: node.y ?? 0 },
        node
      );
    }

    return quadTree;
  }, []);

  // Rebuild QuadTree when nodes change
  useMemo(() => {
    quadTreeRef.current = buildSpatialIndex(allNodes);
  }, [allNodes, buildSpatialIndex]);

  // Cull nodes and edges based on viewport
  const cullToViewport = useCallback((
    viewport: ViewportInfo,
    expandMargin: number = 200
  ): CullingResult => {
    if (!quadTreeRef.current) {
      return {
        visibleNodes: [],
        visibleEdges: [],
        stats: {
          total: 0,
          visible: 0,
          culled: 0,
          lodLevel: LODLevel.MEDIUM,
          edgesCulled: 0
        }
      };
    }

    // Determine LOD level from zoom
    const lodLevel = getLODLevel(viewport.zoom);
    const lodConfig = LOD_CONFIGS[lodLevel];

    // Expand viewport bounds for smooth transitions
    const expandedBounds = expandBounds(viewport.bounds, expandMargin);

    // Query visible nodes
    const visibleNodeData = quadTreeRef.current.query(expandedBounds);
    
    // Sort by importance/degree for LOD limiting
    const sortedNodes = visibleNodeData
      .map(item => item.data)
      .sort((a, b) => {
        const importanceA = a.importance ?? a.degree ?? 0;
        const importanceB = b.importance ?? b.degree ?? 0;
        return importanceB - importanceA;
      });

    // Apply LOD limit
    const visibleNodes = sortedNodes.slice(0, lodConfig.maxNodes);
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    // Cull edges
    let visibleEdges = allEdges.filter(edge => 
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    // Apply edge LOD
    if (visibleEdges.length > lodConfig.maxEdges) {
      // Keep edges by weight/importance
      visibleEdges = visibleEdges
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        .slice(0, lodConfig.maxEdges);
    }

    return {
      visibleNodes,
      visibleEdges,
      stats: {
        total: allNodes.length,
        visible: visibleNodes.length,
        culled: allNodes.length - visibleNodes.length,
        lodLevel,
        edgesCulled: allEdges.length - visibleEdges.length
      }
    };
  }, [allNodes, allEdges]);

  return {
    cullToViewport,
    quadTreeSize: quadTreeRef.current?.size() ?? 0
  };
}
