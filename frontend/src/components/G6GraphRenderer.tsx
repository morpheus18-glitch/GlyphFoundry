import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Graph } from '@antv/g6';
import { Renderer as WebGLRenderer } from '@antv/g-webgl';
import { Renderer as CanvasRenderer } from '@antv/g-canvas';
import { useGraphGestures } from '../hooks/useGraphGestures';
import { usePerformanceMonitor, type QualityTier } from '../hooks/usePerformanceMonitor';
import { getConfigForTier } from '../config/renderingTiers';
import { QualityTierIndicator } from './QualityTierIndicator';

// Types matching backend API
interface ApiNode {
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
}

interface ApiEdge {
  source: string;
  target: string;
  rel?: string;
  weight?: number;
  ts?: number;
}

interface GraphPayload {
  nodes: ApiNode[];
  edges: ApiEdge[];
  stats?: { node_count: number; edge_count: number; window_minutes: number };
}

interface G6GraphRendererProps {
  tenantId: string;
  onNodeSelect?: (node: ApiNode) => void;
  className?: string;
}

// GPU detection
function detectGPU(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
      if (/swiftshader|software|llvmpipe/i.test(renderer)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export const G6GraphRenderer: React.FC<G6GraphRendererProps> = ({
  tenantId,
  onNodeSelect,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<string>('');
  const birthTimestamps = useRef<Map<string, number>>(new Map());
  const seenNodeIds = useRef<Set<string>>(new Set());
  const hasGPU = useRef(detectGPU());
  const animationFrame = useRef<number | null>(null);
  const latestDataRef = useRef<GraphPayload | null>(null);

  // Adaptive rendering system
  const { metrics, currentTier, setTier, isMobile } = usePerformanceMonitor({
    targetFps: 60,
    sampleSize: 60,
    stabilityThreshold: 0.1,
    onTierChange: (tier) => {
      console.log(`🎨 Quality tier changed: ${tier}`);
    }
  });

  // Mobile gesture controls
  useGraphGestures(containerRef, graphRef, {
    onNodeLongPress: (nodeId) => {
      // Long press detected on node
      if (graphRef.current && onNodeSelect && latestDataRef.current) {
        const node = latestDataRef.current.nodes.find(n => n.id === nodeId);
        if (node) {
          onNodeSelect(node);
        }
      }
    },
    onDoubleTap: () => {
      // Double tap to fit view
      if (graphRef.current && 'fitView' in graphRef.current) {
        (graphRef.current as any).fitView();
      }
    }
  });

  // Fetch graph data with adaptive node/edge limits based on tier
  const fetchGraphData = useCallback(async (): Promise<GraphPayload> => {
    const BASE = import.meta.env.VITE_GRAPH_BASE || '/graph3d';
    const TOKEN = import.meta.env.VITE_GRAPH_TOKEN || '';
    const config = getConfigForTier(currentTier);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

    try {
      const response = await fetch(
        `${BASE}/data?window_minutes=525600&limit_nodes=${config.maxNodes}&limit_edges=${config.maxEdges}`,
        { headers }
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('API fetch failed, using sample data:', err);
      const sampleNodes = Math.min(config.maxNodes, 600);
      const sampleEdges = Math.min(config.maxEdges, 1200);
      return makeSampleGraph(sampleNodes, sampleEdges);
    }
  }, [currentTier]);

  // Create sample graph for fallback
  const makeSampleGraph = (n = 600, e = 1200): GraphPayload => {
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
      if (a !== b) {
        edges.push({ 
          source: nodes[a].id, 
          target: nodes[b].id, 
          weight: Math.random() 
        });
      }
    }
    
    return { 
      nodes, 
      edges, 
      stats: { node_count: n, edge_count: e, window_minutes: 60 } 
    };
  };

  // Transform API data to G6 format
  const transformToG6Data = useCallback((data: GraphPayload) => {
    const now = Date.now();
    
    const g6Nodes = data.nodes.map(node => {
      // Track birth timestamps for new nodes
      if (!birthTimestamps.current.has(node.id)) {
        birthTimestamps.current.set(node.id, now);
      }
      
      const importance = node.importance ?? Math.min(1, (node.degree ?? 1) / 8);
      const isImportant = importance > 0.75;
      const color = isImportant ? '#ff00ff' : '#00ffff';
      const baseSize = 8 + importance * 12;
      
      const birthTime = birthTimestamps.current.get(node.id) || now;
      const birthAge = Math.min(1, (now - birthTime) / 1500);
      const birthScale = birthAge < 1 
        ? birthAge * birthAge * (3 - 2 * birthAge) 
        : 1;
      
      return {
        id: node.id,
        data: {
          label: node.label || node.id,
          summary: node.summary,
          degree: node.degree,
          importance,
          originalData: node,
          birthTime,
          x: node.x ?? 0,
          y: node.y ?? 0,
          z: node.z ?? 0,
          type: 'circle-node',
          size: baseSize * birthScale,
          color,
          style: {
            fill: color,
            stroke: color,
            lineWidth: 2,
            opacity: 0.9 * birthScale,
            shadowColor: color,
            shadowBlur: 10 * birthScale,
            label: node.label || '',
            labelFill: '#ffffff',
            labelFontSize: 10,
            labelBackground: true,
            labelBackgroundFill: '#000000',
            labelBackgroundOpacity: 0.7
          }
        }
      };
    });

    const g6Edges = data.edges.map(edge => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      data: {
        weight: edge.weight ?? 1,
        rel: edge.rel,
        type: 'line-edge',
        style: {
          stroke: '#00ffff',
          lineWidth: 1 + (edge.weight ?? 0.5) * 2,
          opacity: 0.3,
          endArrow: false
        }
      }
    }));

    return { nodes: g6Nodes, edges: g6Edges };
  }, []);

  // Initialize G6 graph
  useEffect(() => {
    if (!containerRef.current) return;

    const initGraph = async () => {
      try {
        setLoading(true);
        
        // Fetch initial data
        const rawData = await fetchGraphData();
        latestDataRef.current = rawData;
        const g6Data = transformToG6Data(rawData);
        
        // Mark all initial nodes as seen and set birth timestamps
        const now = Date.now();
        rawData.nodes.forEach(node => {
          seenNodeIds.current.add(node.id);
          birthTimestamps.current.set(node.id, now);
        });
        
        // Update stats
        setStats(`${g6Data.nodes.length} nodes, ${g6Data.edges.length} edges`);

        // Create G6 graph instance
        const graph = new Graph({
          container: containerRef.current!,
          width: containerRef.current!.clientWidth,
          height: containerRef.current!.clientHeight,
          renderer: () => hasGPU.current ? new WebGLRenderer() : new CanvasRenderer(),
          behaviors: [
            'drag-canvas',
            'zoom-canvas',
            'drag-element',
            'click-select'
          ],
          layout: {
            type: 'force',
            preventOverlap: true,
            nodeSize: 30,
            linkDistance: 150,
            nodeStrength: -30,
            edgeStrength: 0.1,
            collideStrength: 0.8
          },
          data: g6Data,
          node: {
            style: {
              size: 10,
              fill: '#00ffff',
              stroke: '#00ffff',
              lineWidth: 2
            },
            palette: {
              type: 'group',
              field: (d: any) => d.data?.importance > 0.75 ? 'important' : 'normal',
              color: ['#00ffff', '#ff00ff']
            }
          },
          edge: {
            style: {
              stroke: '#00ffff',
              lineWidth: 1,
              opacity: 0.3
            }
          }
        });

        await graph.render();

        // Node click handler
        graph.on('node:click', (evt: any) => {
          const nodeModel = graph.getNodeData(evt.itemId);
          if (nodeModel?.data?.originalData && onNodeSelect) {
            onNodeSelect(nodeModel.data.originalData as ApiNode);
          }
        });

        // Store graph ref
        graphRef.current = graph;
        setLoading(false);
        setError(null);

      } catch (err) {
        console.error('G6 Graph initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize graph');
        setLoading(false);
      }
    };

    initGraph();

    // Cleanup
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [tenantId, fetchGraphData, transformToG6Data, onNodeSelect]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.setSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Poll for updates every 3 seconds and track new nodes
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!graphRef.current) return;
      
      try {
        const rawData = await fetchGraphData();
        latestDataRef.current = rawData;
        
        // Detect new nodes and set their birth timestamps
        const now = Date.now();
        const newNodeFound = rawData.nodes.some(node => {
          if (!seenNodeIds.current.has(node.id)) {
            seenNodeIds.current.add(node.id);
            birthTimestamps.current.set(node.id, now);
            return true;
          }
          return false;
        });
        
        const g6Data = transformToG6Data(rawData);
        graphRef.current.changeData(g6Data);
        
        // Restart animation loop if new nodes detected
        if (newNodeFound && !animationFrame.current) {
          const animateBirths = () => {
            if (!graphRef.current || !latestDataRef.current) return;
            
            const now = Date.now();
            let needsUpdate = false;
            
            birthTimestamps.current.forEach((birthTime) => {
              const birthAge = (now - birthTime) / 1500;
              if (birthAge < 1) {
                needsUpdate = true;
              }
            });
            
            if (needsUpdate) {
              const updatedData = transformToG6Data(latestDataRef.current);
              graphRef.current.changeData(updatedData);
              animationFrame.current = requestAnimationFrame(animateBirths);
            } else {
              animationFrame.current = null;
            }
          };
          animateBirths();
        }
        
        setStats(`${g6Data.nodes.length} nodes, ${g6Data.edges.length} edges`);
      } catch (err) {
        console.warn('Failed to update graph:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchGraphData, transformToG6Data]);

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Stats overlay */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg border border-cyan-500/30">
        <div className="text-cyan-400 text-sm font-mono">
          {hasGPU.current ? '⚡ WebGL Accelerated' : '📊 Canvas Renderer'}
        </div>
        <div className="text-white/80 text-xs mt-1">{stats}</div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
            <div className="text-cyan-400 text-sm">Loading G6 knowledge graph...</div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center max-w-md p-8">
            <div className="text-red-500 text-xl mb-2">⚠️ Error</div>
            <div className="text-white/80 text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* Quality Tier Indicator */}
      {!loading && !error && (
        <QualityTierIndicator
          tier={currentTier}
          metrics={metrics}
          onTierChange={setTier}
          showDetails={true}
        />
      )}
    </div>
  );
};
