import React, { useEffect, useState } from 'react';
import { BabylonWebGPURenderer } from './BabylonWebGPURenderer';
import { BabylonWebGLRenderer } from './BabylonWebGLRenderer';
import { ThreeJSFallbackRenderer } from './ThreeJSFallbackRenderer';
import { selectOptimalRenderer, getRendererDisplayName, getRendererFeatures, RendererTier } from '../services/rendererSelector';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  size?: number;
  color?: string;
  label?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
}

interface UnifiedRendererProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
  manualTier?: RendererTier;
}

export const UnifiedRenderer: React.FC<UnifiedRendererProps> = ({
  nodes,
  edges,
  onNodeClick,
  className = '',
  manualTier
}) => {
  const [selectedTier, setSelectedTier] = useState<RendererTier | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    const detectRenderer = async () => {
      setIsDetecting(true);
      
      if (manualTier) {
        setSelectedTier(manualTier);
        setIsDetecting(false);
        return;
      }

      try {
        const selection = await selectOptimalRenderer();
        console.log('🎨 Renderer selected:', selection.tier);
        console.log('📊 Reasoning:', selection.reasoning);
        console.log('💻 Capabilities:', selection.capabilities);
        setSelectedTier(selection.tier);
      } catch (error) {
        console.error('❌ Renderer detection failed:', error);
        setSelectedTier('threejs-fallback');
      } finally {
        setIsDetecting(false);
      }
    };

    detectRenderer();
  }, [manualTier]);

  useEffect(() => {
    if (showInfo) {
      const timer = setTimeout(() => setShowInfo(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showInfo]);

  if (isDetecting) {
    return (
      <div className={`relative w-full h-full ${className} bg-black flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-cyan-400 text-2xl mb-3 animate-pulse">
            Detecting Optimal Renderer...
          </div>
          <div className="text-cyan-400/60 text-sm">
            Analyzing GPU capabilities
          </div>
        </div>
      </div>
    );
  }

  if (!selectedTier) {
    return (
      <div className={`relative w-full h-full ${className} bg-black flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">Renderer Detection Failed</div>
          <div className="text-red-400/60 text-sm">No compatible renderer found</div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (selectedTier) {
      case 'webgpu-babylon':
        return (
          <BabylonWebGPURenderer
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            className={className}
          />
        );
      
      case 'webgl-babylon':
        return (
          <BabylonWebGLRenderer
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            className={className}
          />
        );
      
      case 'threejs-fallback':
        return (
          <ThreeJSFallbackRenderer
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            className={className}
          />
        );
      
      default:
        return (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="text-red-400">Unknown renderer tier: {selectedTier}</div>
          </div>
        );
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {renderContent()}
      
      {showInfo && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-xl px-6 py-4 rounded-lg border border-cyan-500/50 shadow-2xl">
          <div className="text-cyan-400 font-bold text-lg mb-2">
            {getRendererDisplayName(selectedTier)}
          </div>
          <div className="text-cyan-400/70 text-sm space-y-1">
            {getRendererFeatures(selectedTier).map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-cyan-400">•</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowInfo(false)}
            className="mt-3 text-cyan-400/60 hover:text-cyan-400 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
