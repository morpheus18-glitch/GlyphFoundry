/**
 * Bloom Post-Processing for G6 WebGL Renderer
 * Implements HDR bloom effect for ultra-bright neon aesthetics
 */

export interface BloomConfig {
  strength: number;      // 0-3, bloom intensity
  threshold: number;     // 0-1, brightness threshold for bloom
  radius: number;        // 1-10, blur radius
  enabled: boolean;
}

export class BloomPostProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sourceCanvas: HTMLCanvasElement;
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private config: BloomConfig;

  constructor(sourceCanvas: HTMLCanvasElement, config: BloomConfig) {
    this.sourceCanvas = sourceCanvas;
    this.config = config;

    // Create overlay canvas for bloom effect
    this.canvas = document.createElement('canvas');
    this.canvas.width = sourceCanvas.width;
    this.canvas.height = sourceCanvas.height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;

    // Create temp canvas for bloom calculation
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCanvas.width = sourceCanvas.width;
    this.bloomCanvas.height = sourceCanvas.height;
    this.bloomCtx = this.bloomCanvas.getContext('2d', { alpha: true })!;

    // Insert overlay canvas after source
    sourceCanvas.parentElement?.appendChild(this.canvas);
  }

  updateConfig(config: Partial<BloomConfig>) {
    this.config = { ...this.config, ...config };
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.bloomCanvas.width = width;
    this.bloomCanvas.height = height;
  }

  render() {
    if (!this.config.enabled) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    // Clear bloom canvas
    this.bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);

    // Copy source canvas
    this.bloomCtx.drawImage(this.sourceCanvas, 0, 0);

    // Get image data for threshold processing
    const imageData = this.bloomCtx.getImageData(
      0,
      0,
      this.bloomCanvas.width,
      this.bloomCanvas.height
    );
    const data = imageData.data;

    // Extract bright pixels (threshold)
    const threshold = this.config.threshold * 255;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      
      if (brightness < threshold) {
        // Dim pixels below threshold
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        // Boost bright pixels for HDR effect
        const boost = 1 + this.config.strength * 0.5;
        data[i] = Math.min(255, data[i] * boost);
        data[i + 1] = Math.min(255, data[i + 1] * boost);
        data[i + 2] = Math.min(255, data[i + 2] * boost);
      }
    }

    this.bloomCtx.putImageData(imageData, 0, 0);

    // Apply blur (simulated bloom)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = `blur(${this.config.radius}px)`;
    this.ctx.globalCompositeOperation = 'screen'; // Additive blending
    this.ctx.globalAlpha = this.config.strength * 0.8;
    this.ctx.drawImage(this.bloomCanvas, 0, 0);

    // Apply blur multiple times for smoother glow
    for (let i = 0; i < 2; i++) {
      this.ctx.globalAlpha = this.config.strength * 0.3;
      this.ctx.drawImage(this.bloomCanvas, 0, 0);
    }

    // Reset context
    this.ctx.filter = 'none';
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1;
  }

  destroy() {
    this.canvas.remove();
  }
}

// Tier-aware bloom configurations
export const BLOOM_CONFIGS: Record<string, BloomConfig> = {
  ultra: {
    strength: 2.5,
    threshold: 0.3,
    radius: 8,
    enabled: true
  },
  high: {
    strength: 2.0,
    threshold: 0.4,
    radius: 6,
    enabled: true
  },
  standard: {
    strength: 1.5,
    threshold: 0.5,
    radius: 4,
    enabled: true
  },
  eco: {
    strength: 0,
    threshold: 1,
    radius: 0,
    enabled: false
  }
};
