import { Scene } from "./SceneTypes";
import { compile, deleteProgram, link } from "../engine/core/GLUtils";
import type { TFParticleSim } from "../engine/particles/TFParticleSim";

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
uniform mat4 uProj, uView;
uniform float uSize;
out float vS;
void main(){
  vec4 mv = uView * vec4(a_pos,1.0);
  gl_Position = uProj * mv;
  gl_PointSize = uSize * (300.0 / -mv.z);
  vS = clamp(1.0 / (0.05 + length(mv.xyz)*0.01), 0.0, 1.0);
}
`;

const FS = `#version 300 es
precision highp float;
in float vS;
out vec4 frag;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r = dot(uv,uv);
  float soft = exp(-r*16.0);
  vec3 col = mix(vec3(0.169,0.894,0.953), vec3(1.0,0.431,0.227), vS*0.9);
  frag = vec4(col, soft);
}
`;

export class ParticleVortex implements Scene {
  name = "ParticleVortex";
  private tf: TFParticleSim;
  private prog!: WebGLProgram;
  private uProj!: WebGLUniformLocation;
  private uView!: WebGLUniformLocation;
  private uSize!: WebGLUniformLocation;

  constructor(tfSim: TFParticleSim) {
    this.tf = tfSim;
  }

  init(gl: WebGL2RenderingContext) {
    this.prog = link(gl, compile(gl, gl.VERTEX_SHADER, VS), compile(gl, gl.FRAGMENT_SHADER, FS));
    this.uProj = gl.getUniformLocation(this.prog, "uProj")!;
    this.uView = gl.getUniformLocation(this.prog, "uView")!;
    this.uSize = gl.getUniformLocation(this.prog, "uSize")!;
  }

  draw(gl: WebGL2RenderingContext, camera: { proj: Float32Array; view: Float32Array }, t: number) {
    const size = 1.2 + Math.sin(t * 0.6) * 0.2;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.uProj, false, camera.proj);
    gl.uniformMatrix4fv(this.uView, false, camera.view);
    gl.uniform1f(this.uSize, size);
    gl.bindVertexArray(this.tf.readBuffer.vao);
    gl.drawArrays(gl.POINTS, 0, this.tf.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  dispose(gl: WebGL2RenderingContext) {
    deleteProgram(gl, this.prog);
  }
}
