import { Scene } from "./SceneTypes";
import { compile, deleteBuffer, deleteProgram, deleteVertexArray, link } from "../engine/core/GLUtils";

const VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 vUV;
void main(){ vUV = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform float uTime;
out vec4 frag;

float wave(vec2 p, vec2 dir, float freq, float phase){
  return sin(6.28318*(dot(p, dir)*freq + phase));
}

void main(){
  vec2 p = vUV*2.0 - 1.0;
  float w1 = wave(p, normalize(vec2(0.9,0.2)), 0.75, uTime*0.07);
  float w2 = wave(p, normalize(vec2(-0.3,1.0)), 0.95, uTime*0.05+1.7);
  float w3 = wave(p, normalize(vec2(0.2,-1.0)), 0.60, uTime*0.09+3.4);
  float s = (w1 + w2 + w3) / 3.0;

  vec3 base = mix(vec3(0.04,0.07,0.09), vec3(0.169,0.894,0.953), 0.5 + 0.5*s);
  vec3 ember = vec3(1.0,0.431,0.227);
  vec3 col = mix(base, ember, smoothstep(0.6, 1.0, s*s));

  float d = dot(p,p);
  float vig = 1.0 - d*0.25;
  frag = vec4(col*vig, 1.0);
}
`;

export class QuantumWavefield implements Scene {
  name = "QuantumWavefield";
  private prog!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private vbo!: WebGLBuffer;
  private uTime!: WebGLUniformLocation;

  init(gl: WebGL2RenderingContext) {
    this.prog = link(gl, compile(gl, gl.VERTEX_SHADER, VS), compile(gl, gl.FRAGMENT_SHADER, FS));
    this.uTime = gl.getUniformLocation(this.prog, "uTime")!;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  draw(gl: WebGL2RenderingContext, _camera: { proj: Float32Array; view: Float32Array }, t: number) {
    gl.useProgram(this.prog);
    gl.uniform1f(this.uTime, t);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(gl: WebGL2RenderingContext) {
    deleteProgram(gl, this.prog);
    deleteVertexArray(gl, this.vao);
    deleteBuffer(gl, this.vbo);
  }
}
