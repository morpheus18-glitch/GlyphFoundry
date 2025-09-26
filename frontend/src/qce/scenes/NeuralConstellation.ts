import { Scene } from "./SceneTypes";
import { compile, deleteBuffer, deleteProgram, deleteVertexArray, link } from "../engine/core/GLUtils";

const VS_POINTS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
uniform mat4 uProj, uView;
uniform float uSize;
out float vGlow;
void main(){
  vec4 mv = uView * vec4(a_pos,1.0);
  gl_Position = uProj * mv;
  gl_PointSize = uSize * (280.0 / -mv.z);
  vGlow = clamp(1.0 / (0.02 + length(mv.xyz)*0.015), 0.0, 1.0);
}
`;

const FS_POINTS = `#version 300 es
precision highp float;
in float vGlow;
out vec4 frag;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r = dot(uv,uv);
  float core = exp(-r*36.0);
  float halo = exp(-r*4.5)*0.6;
  vec3 col = mix(vec3(0.169,0.894,0.953), vec3(1.0,0.431,0.227), clamp(uv.y+0.5,0.0,1.0));
  float a = core + halo*vGlow;
  frag = vec4(col, a);
}
`;

const VS_LINES = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_src;
layout(location=1) in vec3 a_dst;
uniform mat4 uProj, uView;
out float vFade;
void main(){
  vec3 p = mix(a_src, a_dst, float((gl_VertexID & 1) == 1));
  vec4 mv = uView * vec4(p, 1.0);
  gl_Position = uProj * mv;
  vFade = clamp(0.8 - length(mv.xyz)*0.002, 0.0, 0.8);
}
`;

const FS_LINES = `#version 300 es
precision highp float;
in float vFade;
out vec4 frag;
void main(){
  vec3 cyan = vec3(0.169,0.894,0.953);
  vec3 ember = vec3(1.0,0.431,0.227);
  vec3 col = mix(cyan, ember, vFade*0.9);
  frag = vec4(col, vFade);
}
`;

export class NeuralConstellation implements Scene {
  name = "NeuralConstellation";
  private progPoints!: WebGLProgram;
  private progLines!: WebGLProgram;
  private uProjP!: WebGLUniformLocation;
  private uViewP!: WebGLUniformLocation;
  private uSize!: WebGLUniformLocation;
  private uProjL!: WebGLUniformLocation;
  private uViewL!: WebGLUniformLocation;
  private vaoPoints!: WebGLVertexArrayObject;
  private vaoLines!: WebGLVertexArrayObject;
  private pointsBuffer!: WebGLBuffer;
  private lineSrcBuffer!: WebGLBuffer;
  private lineDstBuffer!: WebGLBuffer;
  private countPoints = 120_000;
  private countLines = 40_000;

  init(gl: WebGL2RenderingContext) {
    this.progPoints = link(
      gl,
      compile(gl, gl.VERTEX_SHADER, VS_POINTS),
      compile(gl, gl.FRAGMENT_SHADER, FS_POINTS)
    );
    this.uProjP = gl.getUniformLocation(this.progPoints, "uProj")!;
    this.uViewP = gl.getUniformLocation(this.progPoints, "uView")!;
    this.uSize = gl.getUniformLocation(this.progPoints, "uSize")!;

    this.progLines = link(
      gl,
      compile(gl, gl.VERTEX_SHADER, VS_LINES),
      compile(gl, gl.FRAGMENT_SHADER, FS_LINES)
    );
    this.uProjL = gl.getUniformLocation(this.progLines, "uProj")!;
    this.uViewL = gl.getUniformLocation(this.progLines, "uView")!;

    const pPos = new Float32Array(this.countPoints * 3);
    for (let i = 0; i < this.countPoints; i++) {
      const t = i / this.countPoints;
      const a = 2.39996323 * i;
      const r = 90 * Math.sqrt(t);
      pPos[i * 3 + 0] = Math.cos(a) * r * (Math.random() * 0.3 + 0.7);
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 90;
      pPos[i * 3 + 2] = Math.sin(a) * r * (Math.random() * 0.3 + 0.7);
    }
    this.vaoPoints = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoPoints);
    this.pointsBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pPos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const lineSrc = new Float32Array(this.countLines * 3);
    const lineDst = new Float32Array(this.countLines * 3);
    for (let i = 0; i < this.countLines; i++) {
      const a = (Math.random() * this.countPoints) | 0;
      const b = (a + ((Math.random() * 400) | 0)) % this.countPoints;
      lineSrc[i * 3 + 0] = pPos[a * 3 + 0];
      lineSrc[i * 3 + 1] = pPos[a * 3 + 1];
      lineSrc[i * 3 + 2] = pPos[a * 3 + 2];
      lineDst[i * 3 + 0] = pPos[b * 3 + 0];
      lineDst[i * 3 + 1] = pPos[b * 3 + 1];
      lineDst[i * 3 + 2] = pPos[b * 3 + 2];
    }
    this.vaoLines = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoLines);
    this.lineSrcBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineSrcBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, lineSrc, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    this.lineDstBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineDstBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, lineDst, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  draw(gl: WebGL2RenderingContext, camera: { proj: Float32Array; view: Float32Array }, t: number) {
    gl.useProgram(this.progLines);
    gl.uniformMatrix4fv(this.uProjL, false, camera.proj);
    gl.uniformMatrix4fv(this.uViewL, false, camera.view);
    gl.bindVertexArray(this.vaoLines);
    gl.drawArrays(gl.LINES, 0, this.countLines * 2);
    gl.bindVertexArray(null);

    gl.useProgram(this.progPoints);
    gl.uniformMatrix4fv(this.uProjP, false, camera.proj);
    gl.uniformMatrix4fv(this.uViewP, false, camera.view);
    gl.uniform1f(this.uSize, 1.6 + Math.sin(t * 0.4) * 0.2);
    gl.bindVertexArray(this.vaoPoints);
    gl.drawArrays(gl.POINTS, 0, this.countPoints);
    gl.bindVertexArray(null);
  }

  dispose(gl: WebGL2RenderingContext) {
    deleteProgram(gl, this.progPoints);
    deleteProgram(gl, this.progLines);
    deleteVertexArray(gl, this.vaoPoints);
    deleteVertexArray(gl, this.vaoLines);
    deleteBuffer(gl, this.pointsBuffer);
    deleteBuffer(gl, this.lineSrcBuffer);
    deleteBuffer(gl, this.lineDstBuffer);
  }
}
