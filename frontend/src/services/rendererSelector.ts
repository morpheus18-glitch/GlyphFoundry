import { detectRendererCapabilities, GPUCapabilities } from '../utils/rendererCapabilities';

export type RendererTier = 'webgpu-babylon' | 'webgl-babylon' | 'threejs-fallback';

export interface RendererSelection {
  tier: RendererTier;
  capabilities: GPUCapabilities;
  reasoning: string;
}

export async function selectOptimalRenderer(): Promise<RendererSelection> {
  const capabilities = await detectRendererCapabilities();

  if (capabilities.hasWebGPU && capabilities.gpuTier === 'high' && !capabilities.isMobile) {
    return {
      tier: 'webgpu-babylon',
      capabilities,
      reasoning: `WebGPU tier - ${capabilities.gpuTier} GPU (${capabilities.gpuVendor})`
    };
  }

  if (capabilities.hasWebGL2 && (capabilities.gpuTier === 'high' || capabilities.gpuTier === 'medium')) {
    return {
      tier: 'webgl-babylon',
      capabilities,
      reasoning: `WebGL tier - ${capabilities.gpuTier} GPU (WebGPU not available)`
    };
  }

  if (capabilities.hasWebGL || capabilities.hasWebGL2) {
    return {
      tier: 'threejs-fallback',
      capabilities,
      reasoning: `Three.js fallback - ${capabilities.gpuTier} GPU (Low-end hardware)`
    };
  }

  return {
    tier: 'threejs-fallback',
    capabilities,
    reasoning: 'Three.js fallback - No hardware acceleration detected'
  };
}

export function getRendererDisplayName(tier: RendererTier): string {
  switch (tier) {
    case 'webgpu-babylon':
      return 'WebGPU • Game Engine Quality';
    case 'webgl-babylon':
      return 'WebGL • High Quality';
    case 'threejs-fallback':
      return 'Three.js • Standard Quality';
    default:
      return 'Unknown Renderer';
  }
}

export function getRendererFeatures(tier: RendererTier): string[] {
  switch (tier) {
    case 'webgpu-babylon':
      return [
        'Clustered Forward+ Lighting',
        'PBR Materials',
        'SSAO/SSR Reflections',
        'Volumetric Effects',
        'HDR Bloom',
        'Chromatic Aberration',
        '4x MSAA'
      ];
    case 'webgl-babylon':
      return [
        'Forward Lighting',
        'Standard Materials',
        'SSAO',
        'HDR Bloom',
        'Glow Effects',
        '2x MSAA'
      ];
    case 'threejs-fallback':
      return [
        'Basic Lighting',
        'Standard Materials',
        'Post-Processing',
        'Bloom Effects'
      ];
    default:
      return [];
  }
}
