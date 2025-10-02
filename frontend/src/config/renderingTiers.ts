import type { QualityTier } from '../hooks/usePerformanceMonitor';

export interface RenderingConfig {
  tier: QualityTier;
  displayName: string;
  description: string;
  
  maxNodes: number;
  maxEdges: number;
  
  enableWebGL: boolean;
  enableMSAA: boolean;
  msaaSamples: number;
  
  enableBloom: boolean;
  enableGodRays: boolean;
  enableDOF: boolean;
  enableChromaticAberration: boolean;
  enableVignette: boolean;
  
  animationQuality: 'high' | 'medium' | 'low';
  forceDirectedIterations: number;
  
  edgeThickness: number;
  nodeQuality: 'high' | 'medium' | 'low';
  
  enableShadows: boolean;
  shadowQuality: 'high' | 'medium' | 'low' | 'off';
  
  renderDistance: number;
  cullingEnabled: boolean;
  
  particleEffects: boolean;
  textLabels: boolean;
  antialiasing: boolean;
}

export const RENDERING_TIERS: Record<QualityTier, RenderingConfig> = {
  ultra: {
    tier: 'ultra',
    displayName: 'Ultra',
    description: 'Maximum visual quality - Desktop only',
    
    maxNodes: 10000,
    maxEdges: 30000,
    
    enableWebGL: true,
    enableMSAA: true,
    msaaSamples: 8,
    
    enableBloom: true,
    enableGodRays: true,
    enableDOF: true,
    enableChromaticAberration: true,
    enableVignette: true,
    
    animationQuality: 'high',
    forceDirectedIterations: 100,
    
    edgeThickness: 2.0,
    nodeQuality: 'high',
    
    enableShadows: true,
    shadowQuality: 'high',
    
    renderDistance: 10000,
    cullingEnabled: false,
    
    particleEffects: true,
    textLabels: true,
    antialiasing: true
  },
  
  high: {
    tier: 'high',
    displayName: 'High',
    description: 'Balanced quality and performance',
    
    maxNodes: 5000,
    maxEdges: 15000,
    
    enableWebGL: true,
    enableMSAA: true,
    msaaSamples: 4,
    
    enableBloom: true,
    enableGodRays: false,
    enableDOF: false,
    enableChromaticAberration: true,
    enableVignette: true,
    
    animationQuality: 'high',
    forceDirectedIterations: 80,
    
    edgeThickness: 1.5,
    nodeQuality: 'high',
    
    enableShadows: true,
    shadowQuality: 'medium',
    
    renderDistance: 5000,
    cullingEnabled: true,
    
    particleEffects: true,
    textLabels: true,
    antialiasing: true
  },
  
  standard: {
    tier: 'standard',
    displayName: 'Standard',
    description: 'Optimized for mobile devices',
    
    maxNodes: 2000,
    maxEdges: 6000,
    
    enableWebGL: true,
    enableMSAA: false,
    msaaSamples: 0,
    
    enableBloom: true,
    enableGodRays: false,
    enableDOF: false,
    enableChromaticAberration: false,
    enableVignette: true,
    
    animationQuality: 'medium',
    forceDirectedIterations: 50,
    
    edgeThickness: 1.0,
    nodeQuality: 'medium',
    
    enableShadows: false,
    shadowQuality: 'off',
    
    renderDistance: 3000,
    cullingEnabled: true,
    
    particleEffects: false,
    textLabels: true,
    antialiasing: true
  },
  
  eco: {
    tier: 'eco',
    displayName: 'Eco',
    description: 'Maximum performance - Minimal effects',
    
    maxNodes: 1000,
    maxEdges: 3000,
    
    enableWebGL: true,
    enableMSAA: false,
    msaaSamples: 0,
    
    enableBloom: false,
    enableGodRays: false,
    enableDOF: false,
    enableChromaticAberration: false,
    enableVignette: false,
    
    animationQuality: 'low',
    forceDirectedIterations: 30,
    
    edgeThickness: 0.8,
    nodeQuality: 'low',
    
    enableShadows: false,
    shadowQuality: 'off',
    
    renderDistance: 2000,
    cullingEnabled: true,
    
    particleEffects: false,
    textLabels: false,
    antialiasing: false
  }
};

export function getConfigForTier(tier: QualityTier): RenderingConfig {
  return RENDERING_TIERS[tier];
}

export function getTierColor(tier: QualityTier): string {
  switch (tier) {
    case 'ultra': return '#8b5cf6';
    case 'high': return '#06b6d4';
    case 'standard': return '#10b981';
    case 'eco': return '#f59e0b';
    default: return '#06b6d4';
  }
}

export function getTierIcon(tier: QualityTier): string {
  switch (tier) {
    case 'ultra': return '⚡';
    case 'high': return '🚀';
    case 'standard': return '📱';
    case 'eco': return '🔋';
    default: return '🚀';
  }
}
