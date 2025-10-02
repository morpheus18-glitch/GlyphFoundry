import React from 'react';
import type { QualityTier, PerformanceMetrics } from '../hooks/usePerformanceMonitor';
import { getTierColor, getTierIcon, getConfigForTier } from '../config/renderingTiers';

interface QualityTierIndicatorProps {
  tier: QualityTier;
  metrics: PerformanceMetrics;
  onTierChange?: (tier: QualityTier) => void;
  showDetails?: boolean;
}

export const QualityTierIndicator: React.FC<QualityTierIndicatorProps> = ({
  tier,
  metrics,
  onTierChange,
  showDetails = false
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const config = getConfigForTier(tier);
  const tierColor = getTierColor(tier);
  const tierIcon = getTierIcon(tier);

  const fpsColor = metrics.avgFps >= 55 ? '#10b981' : 
                   metrics.avgFps >= 45 ? '#06b6d4' : 
                   metrics.avgFps >= 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className="bg-black/80 backdrop-blur-sm border rounded-lg overflow-hidden transition-all duration-300"
        style={{ 
          borderColor: tierColor,
          boxShadow: `0 0 20px ${tierColor}40`
        }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors w-full"
        >
          <span className="text-2xl">{tierIcon}</span>
          <div className="text-left">
            <div className="text-xs text-gray-400">Quality</div>
            <div className="font-bold" style={{ color: tierColor }}>
              {config.displayName}
            </div>
          </div>
          <div className="ml-4 text-left">
            <div className="text-xs text-gray-400">FPS</div>
            <div className="font-mono font-bold" style={{ color: fpsColor }}>
              {metrics.avgFps}
            </div>
          </div>
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="border-t p-4 space-y-3" style={{ borderColor: tierColor + '40' }}>
            <div className="text-xs text-gray-400 mb-2">{config.description}</div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Avg FPS:</span>
                <span className="ml-2 font-mono" style={{ color: fpsColor }}>
                  {metrics.avgFps}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Min FPS:</span>
                <span className="ml-2 font-mono text-gray-300">
                  {metrics.minFps}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Frame Time:</span>
                <span className="ml-2 font-mono text-gray-300">
                  {metrics.frameTime.toFixed(1)}ms
                </span>
              </div>
              <div>
                <span className="text-gray-400">Stability:</span>
                <span className={`ml-2 ${metrics.isStable ? 'text-green-400' : 'text-yellow-400'}`}>
                  {metrics.isStable ? '✓' : '⚠'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t" style={{ borderColor: tierColor + '40' }}>
              <div className="text-xs text-gray-400 mb-2">Manual Override</div>
              <div className="grid grid-cols-2 gap-2">
                {(['ultra', 'high', 'standard', 'eco'] as QualityTier[]).map((t) => {
                  const isActive = t === tier;
                  const tColor = getTierColor(t);
                  const tIcon = getTierIcon(t);
                  const tConfig = getConfigForTier(t);
                  
                  return (
                    <button
                      key={t}
                      onClick={() => onTierChange?.(t)}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-2 transition-all ${
                        isActive ? 'ring-2' : 'opacity-50 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: isActive ? tColor + '20' : tColor + '10',
                        color: tColor,
                        boxShadow: isActive ? `0 0 0 2px ${tColor}` : 'none'
                      }}
                    >
                      <span>{tIcon}</span>
                      <span>{tConfig.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {showDetails && (
              <div className="pt-2 border-t text-xs space-y-1" style={{ borderColor: tierColor + '40' }}>
                <div className="text-gray-400 mb-1">Active Features:</div>
                <div className="flex flex-wrap gap-1">
                  {config.enableBloom && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                      Bloom
                    </span>
                  )}
                  {config.enableGodRays && (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                      God Rays
                    </span>
                  )}
                  {config.enableDOF && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                      DOF
                    </span>
                  )}
                  {config.antialiasing && (
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                      AA
                    </span>
                  )}
                  {config.particleEffects && (
                    <span className="px-2 py-0.5 bg-magenta-500/20 text-magenta-400 rounded">
                      Particles
                    </span>
                  )}
                </div>
                <div className="text-gray-500 text-[10px] mt-1">
                  Nodes: {config.maxNodes} | Edges: {config.maxEdges}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
