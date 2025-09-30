import { compile, deleteProgram, deleteRenderbuffer, deleteTexture, link } from "./GLUtils";

const VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 vUV;
void main(){
  vUV = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uColor;
uniform float uExposure;
out vec4 frag;

vec3 aces(vec3 x){
  const mat3 ACESInputMat = mat3(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
  );
  const mat3 ACESOutputMat = mat3(
    1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
  );
  x = ACESInputMat * x;
  vec3 a = x * (x + 0.0245786) - 0.000090537;
  vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081;
  vec3 c = a / b;
  c = ACESOutputMat * c;
  return clamp(c, 0.0, 1.0);
}

void main(){
  vec3 hdr = texture(uColor, vUV).rgb * uExposure;
  vec3 col = aces(hdr);
  frag = vec4(col, 1.0);
}`;

export class HDRPipeline {
  private gl: WebGL2RenderingContext;
  private width = 1;
  private height = 1;
  private framebuffer: WebGLFramebuffer | null = null;
  private color: WebGLTexture | null = null;
  private depth: WebGLRenderbuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private program: WebGLProgram | null = null;
  private uExposure: WebGLUniformLocation | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.setupProgram();
    this.resize(gl.canvas.width || 1, gl.canvas.height || 1);
  }

  private setupProgram() {
    const gl = this.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    this.program = link(gl, vs, fs);
    this.uExposure = gl.getUniformLocation(this.program, "uExposure");
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  resize(width: number, height: number) {
    const gl = this.gl;
    if (width === this.width && height === this.height) return;
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    if (!this.framebuffer) this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

    if (!this.color) this.color = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.color);
    
    // Try RGBA16F first, fallback to RGBA8 if not supported
    const ext = gl.getExtension('EXT_color_buffer_float');
    const internalFormat = ext ? gl.RGBA16F : gl.RGBA;
    const type = ext ? gl.FLOAT : gl.UNSIGNED_BYTE;
    
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, this.width, this.height, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color, 0);

    if (!this.depth) this.depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error(`Framebuffer incomplete: 0x${status.toString(16)}, using fallback`);
      // Fallback: use simpler RGBA8 format
      gl.bindTexture(gl.TEXTURE_2D, this.color);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color, 0);
      
      const fallbackStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (fallbackStatus !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Framebuffer still incomplete after fallback: 0x${fallbackStatus.toString(16)}`);
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bindHDR() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
  }

  resolve(exposure = 1.1) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.color);
    gl.uniform1f(this.uExposure, exposure);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
  }

  dispose() {
    const gl = this.gl;
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    deleteTexture(gl, this.color);
    deleteRenderbuffer(gl, this.depth);
    if (this.vao) gl.deleteVertexArray(this.vao);
    deleteProgram(gl, this.program);
  }
}
