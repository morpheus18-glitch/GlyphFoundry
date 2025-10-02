import { useEffect, useRef, useState } from 'react';
import type { PhysicsEngine } from '../wasm/glyph_physics';

interface PhysicsNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mass: number;
}

interface PhysicsEdge {
  source: string;
  target: string;
  weight: number;
}

interface WasmPhysicsHook {
  engine: PhysicsEngine | null;
  isReady: boolean;
  error: string | null;
  tick: (deltaTime: number) => Promise<PhysicsNode[]>;
  setNodes: (nodes: PhysicsNode[]) => void;
  setEdges: (edges: PhysicsEdge[]) => void;
  setParams: (repulsion: number, attraction: number, damping: number, theta: number) => void;
}

export function useWasmPhysics(): WasmPhysicsHook {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<PhysicsEngine | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initWasm() {
      try {
        // Dynamic import of Wasm module
        const wasmModule = await import('../wasm/glyph_physics');
        
        if (!mounted) return;

        // Create physics engine instance
        const engine = new wasmModule.PhysicsEngine();
        engineRef.current = engine;
        
        setIsReady(true);
        console.log('✅ Rust Wasm Physics Engine initialized');
      } catch (err) {
        console.error('Failed to initialize Wasm physics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    initWasm();

    return () => {
      mounted = false;
    };
  }, []);

  const tick = async (deltaTime: number): Promise<PhysicsNode[]> => {
    if (!engineRef.current) {
      throw new Error('Physics engine not initialized');
    }
    
    const result = await engineRef.current.tick(deltaTime);
    return result as PhysicsNode[];
  };

  const setNodes = (nodes: PhysicsNode[]) => {
    if (engineRef.current) {
      engineRef.current.setNodes(nodes);
    }
  };

  const setEdges = (edges: PhysicsEdge[]) => {
    if (engineRef.current) {
      engineRef.current.setEdges(edges);
    }
  };

  const setParams = (repulsion: number, attraction: number, damping: number, theta: number) => {
    if (engineRef.current) {
      engineRef.current.setParams(repulsion, attraction, damping, theta);
    }
  };

  return {
    engine: engineRef.current,
    isReady,
    error,
    tick,
    setNodes,
    setEdges,
    setParams,
  };
}
