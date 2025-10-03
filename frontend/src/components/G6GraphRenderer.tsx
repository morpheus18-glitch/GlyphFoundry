import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Graph } from '@antv/g6';
import { Renderer as WebGLRenderer } from '@antv/g-webgl';
import { Renderer as CanvasRenderer } from '@antv/g-canvas';
import { useGraphGestures } from '../hooks/useGraphGestures';
import { usePerformanceMonitor, type QualityTier } from '../hooks/usePerformanceMonitor';
import { getConfigForTier } from '../config/renderingTiers';
import { QualityTierIndicator } from './QualityTierIndicator';
import { FocusedNodeView } from './FocusedNodeView';
import { useViewportCulling } from '../hooks/useViewportCulling';
import { useViewportCullingWorker } from '../hooks/useViewportCullingWorker';
import { calculateViewportBounds, type ViewportInfo } from '../utils/viewportCulling';
import { useWasmPhysics } from '../hooks/useWasmPhysics';

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
  const [focusedNode, setFocusedNode] = useState<ApiNode | null>(null);
  const [graphData, setGraphData] = useState<GraphPayload>({ nodes: [], edges: [] }); // State for culling hook
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    center: { x: 0, y: 0 },
    width: 800,
    height: 600,
    zoom: 1.0,
    bounds: { minX: -400, maxX: 400, minY: -300, maxY: 300 }
  });
  const focusedNodeIdRef = useRef<string | null>(null);
  const birthTimestamps = useRef<Map<string, number>>(new Map());
  const seenNodeIds = useRef<Set<string>>(new Set());
  const hasGPU = useRef(detectGPU());
  const animationFrame = useRef<number | null>(null);
  const latestDataRef = useRef<GraphPayload | null>(null);
  const enableCullingRef = useRef<boolean>(true); // Toggle for 1M node mode

  // WASM Physics Engine for faster layout calculation
  const wasmPhysics = useWasmPhysics();
  const physicsTickRef = useRef<number | null>(null);
  const lastPhysicsTime = useRef<number>(0);

  // Adaptive rendering system
  const { metrics, currentTier, setTier, isMobile } = usePerformanceMonitor({
    targetFps: 60,
    sampleSize: 60,
    stabilityThreshold: 0.1,
    onTierChange: (tier) => {
      console.log(`🎨 Quality tier changed: ${tier}`);
    }
  });

  // Viewport culling system (for massive graphs)
  // Use worker-based culling for better performance with large datasets
  const USE_WORKER_CULLING = graphData.nodes.length >= 50000;
  
  const syncCulling = useViewportCulling(graphData.nodes, graphData.edges);
  const workerCulling = useViewportCullingWorker(graphData.nodes, graphData.edges);
  
  const { cullToViewport, quadTreeSize } = USE_WORKER_CULLING ? workerCulling : syncCulling;

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
    
    // Check for test mode URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('test');
    const testNodes = urlParams.get('testNodes');
    
    // Test mode: use synthetic data endpoint
    if (testMode === 'true' || testNodes) {
      const nodeCount = testNodes ? parseInt(testNodes) : 100000;
      console.log(`🧪 TEST MODE: Generating ${nodeCount} synthetic nodes`);
      
      try {
        const response = await fetch(
          `${BASE}/test-data?node_count=${nodeCount}&edge_density=0.001`
        );
        
        if (response.ok) {
          const data = await response.json();
          console.log(`🧪 Generated ${data.stats.node_count} nodes, ${data.stats.edge_count} edges in ${data.stats.generation_time_seconds}s`);
          return data;
        }
      } catch (err) {
        console.error('Test data generation failed:', err);
      }
    }
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(
          `${BASE}/data?window_minutes=525600&limit_nodes=${config.maxNodes}&limit_edges=${config.maxEdges}`,
          { headers }
        );
        
        if (!response.ok) {
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        console.warn('API fetch failed after retries, using sample data:', err);
        const sampleNodes = Math.min(config.maxNodes, 600);
        const sampleEdges = Math.min(config.maxEdges, 1200);
        return makeSampleGraph(sampleNodes, sampleEdges);
      }
    }
    
    const sampleNodes = Math.min(config.maxNodes, 600);
    const sampleEdges = Math.min(config.maxEdges, 1200);
    return makeSampleGraph(sampleNodes, sampleEdges);
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
    const focusedId = focusedNodeIdRef.current;
    
    const g6Nodes = data.nodes.map(node => {
      // Track birth timestamps for new nodes
      if (!birthTimestamps.current.has(node.id)) {
        birthTimestamps.current.set(node.id, now);
      }
      
      const importance = node.importance ?? Math.min(1, (node.degree ?? 1) / 8);
      const isImportant = importance > 0.75;
      const isFocused = focusedId === node.id;
      const isDimmed = focusedId && !isFocused;
      
      const color = isImportant ? '#ff00ff' : '#00ffff';
      const baseSize = 8 + importance * 12;
      
      const birthTime = birthTimestamps.current.get(node.id) || now;
      const birthAge = Math.min(1, (now - birthTime) / 1500);
      const birthScale = birthAge < 1 
        ? birthAge * birthAge * (3 - 2 * birthAge) 
        : 1;
      
      // Apply focus/dim effects
      const focusScale = isFocused ? 2.0 : 1.0;
      const finalSize = baseSize * birthScale * focusScale;
      const opacity = isDimmed ? 0.15 : (isFocused ? 1.0 : 0.9 * birthScale);
      const shadowBlur = isFocused ? 40 : (10 * birthScale);
      
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
          size: finalSize,
          color,
          style: {
            fill: color,
            stroke: color,
            lineWidth: isFocused ? 4 : 2,
            opacity,
            shadowColor: color,
            shadowBlur,
            label: node.label || '',
            labelFill: '#ffffff',
            labelFontSize: isFocused ? 14 : 10,
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

  // Apply viewport culling when viewport changes (for large graphs)
  useEffect(() => {
    if (!graphRef.current || !latestDataRef.current) return;
    
    const nodeCount = latestDataRef.current.nodes.length;
    
    // Only apply culling for graphs with > 10k nodes
    if (nodeCount < 10000 || !enableCullingRef.current) return;

    const applyCulling = async () => {
      // Handle both sync and async culling (worker returns Promise)
      const culled = await Promise.resolve(cullToViewport(viewportInfo, 300));
      
      // Update stats regardless of visible count
      setStats(
        `${culled.stats.visible}/${culled.stats.total} nodes visible | ` +
        `${culled.visibleEdges.length} edges | ` +
        `LOD: ${culled.stats.lodLevel} | ` +
        `Culled: ${culled.stats.culled}` +
        (culled.stats.cullTimeMs ? ` | ${culled.stats.cullTimeMs}ms` : '')
      );
      
      // Always update graph to match culled viewport (even if empty)
      const g6Data = transformToG6Data({
        nodes: culled.visibleNodes,
        edges: culled.visibleEdges,
        stats: latestDataRef.current!.stats
      });

      (graphRef.current as any).changeData?.(g6Data);
      
      if (culled.visibleNodes.length > 0) {
        console.log(`🔍 Viewport culling: ${culled.stats.visible}/${culled.stats.total} nodes, LOD ${culled.stats.lodLevel}${culled.stats.cullTimeMs ? ` (${culled.stats.cullTimeMs}ms)` : ''}`);
      } else {
        console.log(`🔍 Viewport culling: No nodes visible in viewport`);
      }
    };

    applyCulling();
  }, [viewportInfo, cullToViewport, transformToG6Data]);

  // Initialize G6 graph
  useEffect(() => {
    if (!containerRef.current) return;

    const initGraph = async () => {
      try {
        setLoading(true);
        
        // Fetch initial data
        const rawData = await fetchGraphData();
        latestDataRef.current = rawData;
        setGraphData(rawData); // Update state to trigger QuadTree rebuild
        const nodeCount = rawData.nodes.length;
        
        // Mark all initial nodes as seen and set birth timestamps
        const now = Date.now();
        rawData.nodes.forEach(node => {
          seenNodeIds.current.add(node.id);
          birthTimestamps.current.set(node.id, now);
        });
        
        // Check if we should use culling (>10k nodes)
        const isCullingActive = nodeCount >= 10000 && enableCullingRef.current;
        
        // Prepare initial graph data (empty for large graphs, full for small)
        const initialData = isCullingActive 
          ? { nodes: [], edges: [] }  // Start empty, let culling populate
          : transformToG6Data(rawData);
        
        // Update stats
        if (isCullingActive) {
          setStats(`Loading ${nodeCount} nodes... (culling enabled)`);
        } else {
          setStats(`${initialData.nodes.length} nodes, ${initialData.edges.length} edges`);
        }

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
            animated: !wasmPhysics.isReady,
            preventOverlap: true,
            nodeSize: 30,
            linkDistance: 150,
            nodeStrength: -30,
            edgeStrength: 0.1,
            collideStrength: 0.8
          },
          data: initialData,
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

        // Store graph ref BEFORE any physics initialization
        graphRef.current = graph;

        // Track viewport changes for culling
        const updateViewport = () => {
          if (!containerRef.current || !graph) return;

          try {
            // Get current zoom from G6
            const zoom = (graph as any).getZoom?.() ?? 1.0;
            
            // Get camera position - G6 uses methods, not properties
            const camera = (graph as any).getCamera?.();
            const position = camera?.getPosition?.() ?? [0, 0];
            const [x, y] = position;
            
            const { clientWidth, clientHeight } = containerRef.current;

            const bounds = calculateViewportBounds(
              { x, y },
              clientWidth,
              clientHeight,
              zoom
            );

            setViewportInfo({
              center: { x, y },
              width: clientWidth,
              height: clientHeight,
              zoom,
              bounds
            });
            
            console.log(`📹 Viewport updated: center(${x.toFixed(0)}, ${y.toFixed(0)}), zoom: ${zoom.toFixed(2)}`);
          } catch (err) {
            console.warn('Failed to update viewport:', err);
          }
        };

        // Store graph ref BEFORE initial viewport update (needed for culling)
        graphRef.current = graph;
        
        // Listen to viewport change events
        graph.on('viewportchange', updateViewport);
        graph.on('afterzoom', updateViewport);
        graph.on('aftertranslate', updateViewport);
        
        // Initial viewport setup (now graphRef is set, culling can work)
        updateViewport();

        // Node click handler with focus and zoom
        graph.on('node:click', async (evt: any) => {
          const nodeModel = graph.getNodeData(evt.itemId);
          if (nodeModel?.data?.originalData) {
            const node = nodeModel.data.originalData as ApiNode;
            
            // Set focused node for detail view and visual effects
            setFocusedNode(node);
            focusedNodeIdRef.current = node.id;
            
            // Update visual effects (skip for large graphs, culling handles it)
            if (latestDataRef.current) {
              const nodeCount = latestDataRef.current.nodes.length;
              const isCullingActive = nodeCount >= 10000 && enableCullingRef.current;
              
              if (!isCullingActive) {
                const updatedData = transformToG6Data(latestDataRef.current);
                (graph as any).changeData(updatedData);
              }
            }
            
            // Zoom camera to node with animation using G6 v5 API
            const nodeData = graph.getNodeData(evt.itemId);
            const x = Number(nodeData?.data?.x);
            const y = Number(nodeData?.data?.y);
            
            if (!isNaN(x) && !isNaN(y)) {
              const position = { x, y } as any;
              
              // Pan to node
              await (graph as any).translateTo(position, {
                duration: 500,
                easing: 'ease-in-out'
              });
              
              // Zoom in to 1.5x
              await (graph as any).zoomTo(1.5, {
                duration: 500,
                easing: 'ease-in-out'
              }, position);
            }
            
            // Call parent handler
            if (onNodeSelect) {
              onNodeSelect(node);
            }
          }
        });

        // Graph ref already set above (before updateViewport)
        setLoading(false);
        setError(null);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('G6 Graph initialization failed:', errorMsg, err);
        setError(`Graph initialization failed: ${errorMsg}`);
        setLoading(false);
      }
    };

    initGraph();

    // Cleanup
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (physicsTickRef.current) {
        cancelAnimationFrame(physicsTickRef.current);
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

  // ESC key handler to close focused view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusedNode) {
        setFocusedNode(null);
        focusedNodeIdRef.current = null;
        
        // Update visual effects to remove dimming (skip for large graphs)
        if (graphRef.current && latestDataRef.current) {
          const nodeCount = latestDataRef.current.nodes.length;
          const isCullingActive = nodeCount >= 10000 && enableCullingRef.current;
          
          if (!isCullingActive) {
            const updatedData = transformToG6Data(latestDataRef.current);
            graphRef.current.changeData(updatedData);
          }
        }
        
        // Reset camera zoom
        if (graphRef.current && 'fitView' in graphRef.current) {
          (graphRef.current as any).fitView({ 
            duration: 500,
            easing: 'ease-in-out'
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedNode, transformToG6Data]);

  // Helper to prepare node data for focused view
  const prepareFocusedNodeData = useCallback((node: ApiNode) => {
    const connections = latestDataRef.current?.edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => {
        const connectedId = e.source === node.id ? e.target : e.source;
        const connectedNode = latestDataRef.current?.nodes.find(n => n.id === connectedId);
        return {
          id: connectedId,
          name: connectedNode?.label || connectedId,
          weight: e.weight
        };
      })
      .slice(0, 6) || [];

    return {
      id: node.id,
      name: node.label || node.id,
      summary: node.summary,
      content: node.summary || `Node ${node.id}`,
      tags: node.kind ? [node.kind] : [],
      connections,
      metadata: {
        duration: node.degree ? node.degree * 5 : undefined,
        messageCount: node.degree,
        participantCount: connections.length
      }
    };
  }, []);

  // Poll for updates every 3 seconds and track new nodes
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!graphRef.current) return;
      
      try {
        const rawData = await fetchGraphData();
        latestDataRef.current = rawData;
        setGraphData(rawData); // Update state to trigger QuadTree rebuild
        const nodeCount = rawData.nodes.length;
        
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
        
        // Check if culling is active (>10k nodes)
        const isCullingActive = nodeCount >= 10000 && enableCullingRef.current;
        
        if (isCullingActive) {
          // For large graphs: skip full transform, let viewport culling effect handle updates
          // Just trigger viewport update to re-cull with new data
          if (graphRef.current && containerRef.current) {
            const zoom = (graphRef.current as any).getZoom?.() ?? 1.0;
            const camera = (graphRef.current as any).getCamera?.();
            const position = camera?.getPosition?.() ?? [0, 0];
            const [x, y] = position;
            const { clientWidth, clientHeight } = containerRef.current;
            
            const bounds = calculateViewportBounds(
              { x, y },
              clientWidth,
              clientHeight,
              zoom
            );
            
            setViewportInfo({
              center: { x, y },
              width: clientWidth,
              height: clientHeight,
              zoom,
              bounds
            });
          }
        } else {
          // For small graphs: use normal full-graph update
          const g6Data = transformToG6Data(rawData);
          graphRef.current.changeData(g6Data);
          setStats(`${g6Data.nodes.length} nodes, ${g6Data.edges.length} edges`);
          
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
        }
      } catch (err) {
        console.warn('Failed to update graph:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchGraphData, transformToG6Data]);

  // Separate effect to initialize WASM physics when ready
  useEffect(() => {
    if (!wasmPhysics.isReady || !graphRef.current || !latestDataRef.current) {
      return;
    }

    const rawData = latestDataRef.current;
    if (rawData.nodes.length === 0) return;

    console.log('🚀 Initializing WASM physics bridge...');
    console.log(`✅ Rust Wasm Physics Engine initialized`);
    
    // Convert nodes to physics format
    const physicsNodes = rawData.nodes.map(node => ({
      id: node.id,
      x: node.x ?? Math.random() * 1000 - 500,
      y: node.y ?? Math.random() * 1000 - 500,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      mass: (node.importance ?? 0.5) * 10 + 1
    }));

    // Convert edges to physics format
    const physicsEdges = rawData.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight ?? 1.0
    }));

    // Initialize WASM physics engine
    wasmPhysics.setNodes(physicsNodes);
    wasmPhysics.setEdges(physicsEdges);
    wasmPhysics.setParams(
      500,    // repulsion
      0.5,    // attraction
      0.9,    // damping
      0.5     // theta (Barnes-Hut approximation)
    );

    // Physics tick loop
    let iterations = 0;
    const maxIterations = 100;
    const startPhysicsLoop = () => {
      if (iterations >= maxIterations || !graphRef.current) {
        console.log(`✅ WASM physics completed: ${iterations} iterations`);
        return;
      }

      const tickStart = performance.now();
      
      wasmPhysics.tick(0.016).then((updatedNodes) => {
        const tickTime = performance.now() - tickStart;
        
        // Apply positions to G6
        updatedNodes.forEach(node => {
          const g6Node = graphRef.current?.getNodeData(node.id);
          if (g6Node && graphRef.current) {
            graphRef.current.updateNodeData([{
              id: node.id,
              data: {
                ...g6Node.data,
                x: node.x,
                y: node.y
              }
            }]);
          }
        });

        iterations++;
        
        // Log performance every 20 iterations
        if (iterations % 20 === 0) {
          const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          const target = isMobileDevice ? 25 : 16;
          const status = tickTime <= target ? '✅' : '⚠️';
          console.log(`${status} WASM physics tick ${iterations}: ${tickTime.toFixed(2)}ms (target: ≤${target}ms)`);
        }

        // Continue loop
        physicsTickRef.current = requestAnimationFrame(startPhysicsLoop);
      });
    };

    startPhysicsLoop();
  }, [wasmPhysics.isReady, wasmPhysics]);

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

      {/* Focused Node View */}
      {focusedNode && (
        <FocusedNodeView
          node={prepareFocusedNodeData(focusedNode)}
          onClose={() => {
            setFocusedNode(null);
            focusedNodeIdRef.current = null;
            
            // Update visual effects to remove dimming (skip for large graphs)
            if (graphRef.current && latestDataRef.current) {
              const nodeCount = latestDataRef.current.nodes.length;
              const isCullingActive = nodeCount >= 10000 && enableCullingRef.current;
              
              if (!isCullingActive) {
                const updatedData = transformToG6Data(latestDataRef.current);
                graphRef.current.changeData(updatedData);
              }
            }
            
            // Reset camera zoom
            if (graphRef.current && 'fitView' in graphRef.current) {
              (graphRef.current as any).fitView({ 
                duration: 500,
                easing: 'ease-in-out'
              });
            }
          }}
        />
      )}
    </div>
  );
};
