export type RendererTier = 'webgpu' | 'webgl-babylon' | 'threejs' | 'canvas2d';

export interface GPUCapabilities {
  tier: RendererTier;
  hasWebGPU: boolean;
  hasWebGL2: boolean;
  hasWebGL: boolean;
  gpuTier: 'high' | 'medium' | 'low' | 'unknown';
  gpuVendor: string;
  gpuRenderer: string;
  maxTextureSize: number;
  isMobile: boolean;
  canUseAdvancedEffects: boolean;
}

async function detectWebGPU(): Promise<boolean> {
  if (!navigator.gpu) {
    return false;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

function detectWebGL2(): Promise<{ supported: boolean; context?: WebGL2RenderingContext }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    
    if (gl) {
      resolve({ supported: true, context: gl });
    } else {
      resolve({ supported: false });
    }
  });
}

function detectWebGL(): Promise<{ supported: boolean; context?: WebGLRenderingContext }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (gl) {
      resolve({ supported: true, context: gl as WebGLRenderingContext });
    } else {
      resolve({ supported: false });
    }
  });
}

function getGPUInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): { vendor: string; renderer: string } {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  
  if (debugInfo) {
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string;
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
    return { vendor, renderer };
  }
  
  return {
    vendor: gl.getParameter(gl.VENDOR) as string,
    renderer: gl.getParameter(gl.RENDERER) as string
  };
}

function classifyGPUTier(vendor: string, renderer: string, isMobile: boolean): 'high' | 'medium' | 'low' | 'unknown' {
  const rendererLower = renderer.toLowerCase();
  const vendorLower = vendor.toLowerCase();
  
  if (/swiftshader|llvmpipe|software/i.test(rendererLower)) {
    return 'low';
  }
  
  if (isMobile) {
    if (/adreno (7|8)|mali-g7|mali-g8|apple (a15|a16|a17|m1|m2)/i.test(rendererLower)) {
      return 'high';
    }
    if (/adreno (5|6)|mali-g5|mali-g6|apple a(12|13|14)/i.test(rendererLower)) {
      return 'medium';
    }
    return 'low';
  } else {
    if (/rtx|quadro|radeon rx (6|7)|arc a/i.test(rendererLower)) {
      return 'high';
    }
    if (/gtx|radeon rx (5|vega)|intel.*iris/i.test(rendererLower)) {
      return 'medium';
    }
    if (/intel.*hd|uhd graphics/i.test(rendererLower)) {
      return 'low';
    }
    return 'medium';
  }
}

export async function detectRendererCapabilities(): Promise<GPUCapabilities> {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  const hasWebGPU = await detectWebGPU();
  const webgl2Result = await detectWebGL2();
  const webglResult = await detectWebGL();
  
  const hasWebGL2 = webgl2Result.supported;
  const hasWebGL = webglResult.supported;
  
  let gpuVendor = 'Unknown';
  let gpuRenderer = 'Unknown';
  let maxTextureSize = 2048;
  let gpuTier: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';
  
  if (webgl2Result.context) {
    const info = getGPUInfo(webgl2Result.context);
    gpuVendor = info.vendor;
    gpuRenderer = info.renderer;
    maxTextureSize = webgl2Result.context.getParameter(webgl2Result.context.MAX_TEXTURE_SIZE) as number;
    gpuTier = classifyGPUTier(gpuVendor, gpuRenderer, isMobile);
  } else if (webglResult.context) {
    const info = getGPUInfo(webglResult.context);
    gpuVendor = info.vendor;
    gpuRenderer = info.renderer;
    maxTextureSize = webglResult.context.getParameter(webglResult.context.MAX_TEXTURE_SIZE) as number;
    gpuTier = classifyGPUTier(gpuVendor, gpuRenderer, isMobile);
  }
  
  let tier: RendererTier = 'canvas2d';
  
  if (hasWebGPU && gpuTier === 'high' && !isMobile) {
    tier = 'webgpu';
  } else if (hasWebGL2 && (gpuTier === 'high' || gpuTier === 'medium')) {
    tier = 'webgl-babylon';
  } else if (hasWebGL || hasWebGL2) {
    tier = 'threejs';
  }
  
  const canUseAdvancedEffects = tier === 'webgpu' || (tier === 'webgl-babylon' && gpuTier === 'high');
  
  return {
    tier,
    hasWebGPU,
    hasWebGL2,
    hasWebGL,
    gpuTier,
    gpuVendor,
    gpuRenderer,
    maxTextureSize,
    isMobile,
    canUseAdvancedEffects
  };
}

export function getRendererTierName(tier: RendererTier): string {
  switch (tier) {
    case 'webgpu':
      return 'WebGPU (Game Engine Quality)';
    case 'webgl-babylon':
      return 'WebGL Babylon (High Quality)';
    case 'threejs':
      return 'Three.js (Standard)';
    case 'canvas2d':
      return 'Canvas 2D (Fallback)';
  }
}
