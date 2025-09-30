import type { Scene } from './SceneTypes';

export class EarthCinematic implements Scene {
  name = 'EarthCinematic' as const;
  private gl: WebGL2RenderingContext;
  private programEarth: WebGLProgram | null = null;
  private programParticles: WebGLProgram | null = null;
  private programHDR: WebGLProgram | null = null;
  private vaoEarth: WebGLVertexArrayObject | null = null;
  private vaoParticles: WebGLVertexArrayObject | null = null;
  private hdrFramebuffer: WebGLFramebuffer | null = null;
  private hdrTexture: WebGLTexture | null = null;
  private time = 0;
  private earthRotation = 0;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleCount = 5000;

  constructor() {
    this.gl = null as any;
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);
  }

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.initParticles();
    this.initShaders();
    this.initGeometry();
    this.initHDR();
  }

  private initParticles(): void {
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 3 + Math.random() * 2;

      this.particlePositions[i3] = r * Math.sin(phi) * Math.cos(theta);
      this.particlePositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      this.particlePositions[i3 + 2] = r * Math.cos(phi);

      this.particleVelocities[i3] = (Math.random() - 0.5) * 0.01;
      this.particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
      this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
    }
  }

  private initShaders(): void {
    const gl = this.gl;

    // Earth shader
    const earthVert = `#version 300 es
      precision highp float;
      in vec3 position;
      in vec3 normal;
      uniform mat4 uModelView;
      uniform mat4 uProjection;
      uniform float uTime;
      out vec3 vNormal;
      out vec3 vPosition;
      
      void main() {
        vNormal = normal;
        vPosition = position;
        gl_Position = uProjection * uModelView * vec4(position, 1.0);
      }
    `;

    const earthFrag = `#version 300 es
      precision highp float;
      in vec3 vNormal;
      in vec3 vPosition;
      uniform float uTime;
      out vec4 fragColor;
      
      void main() {
        vec3 normal = normalize(vNormal);
        float fresnel = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), 3.0);
        
        // Procedural earth-like pattern
        float lat = atan(vPosition.y, vPosition.x) * 3.0 + uTime * 0.1;
        float lng = asin(vPosition.z / length(vPosition)) * 5.0;
        float pattern = sin(lat) * cos(lng) * 0.5 + 0.5;
        
        vec3 ocean = vec3(0.0, 0.3, 0.7);
        vec3 land = vec3(0.2, 0.6, 0.3);
        vec3 baseColor = mix(ocean, land, pattern);
        
        // Atmospheric glow (HDR values)
        vec3 glow = vec3(0.0, 0.8, 1.0) * fresnel * 3.0;
        
        // HDR output
        fragColor = vec4(baseColor + glow, 1.0);
      }
    `;

    // Particle shader
    const particleVert = `#version 300 es
      precision highp float;
      in vec3 position;
      uniform mat4 uModelView;
      uniform mat4 uProjection;
      
      void main() {
        gl_Position = uProjection * uModelView * vec4(position, 1.0);
        gl_PointSize = 3.0;
      }
    `;

    const particleFrag = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        // HDR particle emission
        float intensity = 1.0 - dist * 2.0;
        fragColor = vec4(vec3(0.5, 0.9, 1.0) * intensity * 2.0, intensity);
      }
    `;

    // HDR tone mapping shader
    const hdrVert = `#version 300 es
      precision highp float;
      in vec2 position;
      out vec2 vUv;
      
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const hdrFrag = `#version 300 es
      precision highp float;
      in vec2 vUv;
      uniform sampler2D uHDRTexture;
      uniform float uExposure;
      out vec4 fragColor;
      
      vec3 ACESFilm(vec3 x) {
        float a = 2.51;
        float b = 0.03;
        float c = 2.43;
        float d = 0.59;
        float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      
      void main() {
        vec3 hdrColor = texture(uHDRTexture, vUv).rgb;
        hdrColor *= uExposure;
        
        // ACES Filmic Tone Mapping
        vec3 mapped = ACESFilm(hdrColor);
        
        // Gamma correction
        mapped = pow(mapped, vec3(1.0 / 2.2));
        
        fragColor = vec4(mapped, 1.0);
      }
    `;

    this.programEarth = this.createProgram(earthVert, earthFrag);
    this.programParticles = this.createProgram(particleVert, particleFrag);
    this.programHDR = this.createProgram(hdrVert, hdrFrag);
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram | null {
    const gl = this.gl;
    const vert = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vert, vertSrc);
    gl.compileShader(vert);

    const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(frag, fragSrc);
    gl.compileShader(frag);

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    return program;
  }

  private initGeometry(): void {
    const gl = this.gl;

    // Create sphere geometry (Earth)
    const sphereData = this.createSphere(1.0, 32, 32);
    this.vaoEarth = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoEarth);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereData.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereData.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    const idxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereData.indices, gl.STATIC_DRAW);

    // Create particle geometry
    this.vaoParticles = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoParticles);

    const particleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particlePositions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private createSphere(radius: number, widthSegs: number, heightSegs: number) {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y <= heightSegs; y++) {
      const v = y / heightSegs;
      const phi = v * Math.PI;

      for (let x = 0; x <= widthSegs; x++) {
        const u = x / widthSegs;
        const theta = u * Math.PI * 2;

        const px = -radius * Math.cos(theta) * Math.sin(phi);
        const py = radius * Math.cos(phi);
        const pz = radius * Math.sin(theta) * Math.sin(phi);

        positions.push(px, py, pz);
        normals.push(px / radius, py / radius, pz / radius);
      }
    }

    for (let y = 0; y < heightSegs; y++) {
      for (let x = 0; x < widthSegs; x++) {
        const a = y * (widthSegs + 1) + x;
        const b = a + widthSegs + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint16Array(indices)
    };
  }

  private initHDR(): void {
    const gl = this.gl;
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    // Create HDR framebuffer
    this.hdrFramebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFramebuffer);

    // Create HDR texture (RGB16F)
    this.hdrTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.hdrTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, width, height, 0, gl.RGB, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.hdrTexture, 0);

    // Create depth renderbuffer
    const depthBuffer = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  draw(gl: WebGL2RenderingContext, camera: { proj: Float32Array; view: Float32Array }, t: number, dt: number): void {
    const deltaTime = dt;
    this.gl = gl;
    this.time += deltaTime;
    this.earthRotation += deltaTime * 0.2;

    // Update particles (compute-like simulation)
    this.updateParticles(deltaTime);

    // Render to HDR framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFramebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // Use provided camera matrices
    const projection = camera.proj;
    const modelView = camera.view;

    // Render Earth
    if (this.programEarth) {
      gl.useProgram(this.programEarth);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.programEarth, 'uProjection'), false, projection);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.programEarth, 'uModelView'), false, modelView);
      gl.uniform1f(gl.getUniformLocation(this.programEarth, 'uTime'), this.time);

      gl.bindVertexArray(this.vaoEarth);
      gl.drawElements(gl.TRIANGLES, 32 * 32 * 6, gl.UNSIGNED_SHORT, 0);
    }

    // Render particles
    if (this.programParticles) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.depthMask(false);

      gl.useProgram(this.programParticles);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.programParticles, 'uProjection'), false, projection);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.programParticles, 'uModelView'), false, modelView);

      // Update particle buffer
      gl.bindVertexArray(this.vaoParticles);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.getParameter(gl.ARRAY_BUFFER_BINDING));
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particlePositions);
      gl.drawArrays(gl.POINTS, 0, this.particleCount);

      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // HDR tone mapping pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    if (this.programHDR) {
      gl.useProgram(this.programHDR);
      gl.uniform1i(gl.getUniformLocation(this.programHDR, 'uHDRTexture'), 0);
      gl.uniform1f(gl.getUniformLocation(this.programHDR, 'uExposure'), 1.2);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.hdrTexture);

      // Draw fullscreen quad
      this.drawFullscreenQuad();
    }
  }

  private updateParticles(deltaTime: number): void {
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Update positions
      this.particlePositions[i3] += this.particleVelocities[i3] * deltaTime * 60;
      this.particlePositions[i3 + 1] += this.particleVelocities[i3 + 1] * deltaTime * 60;
      this.particlePositions[i3 + 2] += this.particleVelocities[i3 + 2] * deltaTime * 60;

      // Gravitational pull toward center
      const dx = -this.particlePositions[i3];
      const dy = -this.particlePositions[i3 + 1];
      const dz = -this.particlePositions[i3 + 2];
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);

      if (dist > 0.1) {
        const force = 0.5 / distSq;
        this.particleVelocities[i3] += (dx / dist) * force * deltaTime;
        this.particleVelocities[i3 + 1] += (dy / dist) * force * deltaTime;
        this.particleVelocities[i3 + 2] += (dz / dist) * force * deltaTime;
      }

      // Damping
      this.particleVelocities[i3] *= 0.98;
      this.particleVelocities[i3 + 1] *= 0.98;
      this.particleVelocities[i3 + 2] *= 0.98;
    }
  }

  private drawFullscreenQuad(): void {
    const gl = this.gl;
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  private lookAt(eye: number[], center: number[], up: number[]): Float32Array {
    const z = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]];
    const zLen = Math.sqrt(z[0] * z[0] + z[1] * z[1] + z[2] * z[2]);
    z[0] /= zLen; z[1] /= zLen; z[2] /= zLen;

    const x = [
      up[1] * z[2] - up[2] * z[1],
      up[2] * z[0] - up[0] * z[2],
      up[0] * z[1] - up[1] * z[0]
    ];
    const xLen = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
    x[0] /= xLen; x[1] /= xLen; x[2] /= xLen;

    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];

    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
      1
    ]);
  }

  private rotateY(mat: Float32Array, angle: number): void {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const a00 = mat[0], a01 = mat[1], a02 = mat[2], a03 = mat[3];
    const a20 = mat[8], a21 = mat[9], a22 = mat[10], a23 = mat[11];
    mat[0] = a00 * c - a20 * s;
    mat[1] = a01 * c - a21 * s;
    mat[2] = a02 * c - a22 * s;
    mat[3] = a03 * c - a23 * s;
    mat[8] = a00 * s + a20 * c;
    mat[9] = a01 * s + a21 * c;
    mat[10] = a02 * s + a22 * c;
    mat[11] = a03 * s + a23 * c;
  }

  resize(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    // Resize HDR texture
    if (this.hdrTexture) {
      gl.bindTexture(gl.TEXTURE_2D, this.hdrTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, width, height, 0, gl.RGB, gl.FLOAT, null);
    }
  }

  dispose(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    if (this.programEarth) gl.deleteProgram(this.programEarth);
    if (this.programParticles) gl.deleteProgram(this.programParticles);
    if (this.programHDR) gl.deleteProgram(this.programHDR);
    if (this.vaoEarth) gl.deleteVertexArray(this.vaoEarth);
    if (this.vaoParticles) gl.deleteVertexArray(this.vaoParticles);
    if (this.hdrFramebuffer) gl.deleteFramebuffer(this.hdrFramebuffer);
    if (this.hdrTexture) gl.deleteTexture(this.hdrTexture);
  }
}
