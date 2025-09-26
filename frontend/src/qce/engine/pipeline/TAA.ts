import { loadWasm, taaReproject } from '../utils/wasm';

type CameraState = unknown;

export class TAA {
  private readonly gl: WebGL2RenderingContext;
  private prevRead?: Float32Array;
  private motionBuffer?: Float32Array;
  private outputTex?: WebGLTexture;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  async init(): Promise<void> {
    await loadWasm();
  }

  run(currTex: WebGLTexture, _depthTex: WebGLTexture, _camera: CameraState, dt: number): WebGLTexture {
    const gl = this.gl;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const current = this.readHDR(gl, currTex, width, height);
    const previous = this.prevRead ?? current.slice();
    const motion = this.prepareMotionBuffer(width, height);

    const blend = Math.min(0.93, 0.85 + dt * 0.2);
    const output = taaReproject(current, previous, motion, width, height, blend);

    this.prevRead = output;
    this.updateFromBuffer(gl, output, width, height);

    if (!this.outputTex) {
      throw new Error('Failed to allocate TAA output texture.');
    }
    return this.outputTex;
  }

  resetHistory(): void {
    this.prevRead = undefined;
  }

  private prepareMotionBuffer(width: number, height: number): Float32Array {
    const requiredLength = width * height * 2;
    if (!this.motionBuffer || this.motionBuffer.length !== requiredLength) {
      this.motionBuffer = new Float32Array(requiredLength);
    }
    return this.motionBuffer;
  }

  private readHDR(gl: WebGL2RenderingContext, tex: WebGLTexture, width: number, height: number): Float32Array {
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('Unable to create framebuffer for TAA readback.');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    const rgba = new Float32Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, rgba);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);

    const rgb = new Float32Array(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgb[j] = rgba[i];
      rgb[j + 1] = rgba[i + 1];
      rgb[j + 2] = rgba[i + 2];
    }
    return rgb;
  }

  private updateFromBuffer(gl: WebGL2RenderingContext, rgb: Float32Array, width: number, height: number): void {
    if (!this.outputTex) {
      const texture = gl.createTexture();
      if (!texture) {
        throw new Error('Unable to allocate texture for TAA output.');
      }
      this.outputTex = texture;
      gl.bindTexture(gl.TEXTURE_2D, this.outputTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.outputTex);
    }

    const rgba = new Float32Array(width * height * 4);
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      rgba[j] = rgb[i];
      rgba[j + 1] = rgb[i + 1];
      rgba[j + 2] = rgb[i + 2];
      rgba[j + 3] = 1.0;
    }

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, rgba);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}
