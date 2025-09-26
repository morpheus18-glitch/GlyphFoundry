import { Scene } from "./SceneTypes";
import { compile, deleteBuffer, deleteProgram, deleteVertexArray, link } from "../engine/core/GLUtils";

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
uniform mat4 uProj, uView;
out vec3 vPos;
void main(){
  vec4 mv = uView * vec4(a_pos,1.0);
  gl_Position = uProj * mv;
  vPos = a_pos;
}
`;

const FS = `#version 300 es
precision highp float;
in vec3 vPos;
out vec4 frag;
void main(){
  vec2 uv = gl_FragCoord.xy / vec2(1920.0, 1080.0);
  float r = length(fract(uv*60.0)-0.5);
  float core = exp(-r*20.0);
  float glow = exp(-r*5.0)*0.6;

  vec3 body = mix(vec3(0.169,0.894,0.953), vec3(1.0,0.431,0.227), smoothstep(-30.0,30.0,vPos.y));
  vec3 col = body*(0.6+0.4*glow) + vec3(0.02)*glow*2.0;

  float a = clamp(core + glow*0.6, 0.0, 1.0);
  frag = vec4(col, a);
}
`;

export class VolumetricSpines implements Scene {
  name = "VolumetricSpines";
  private prog!: WebGLProgram;
  private uProj!: WebGLUniformLocation;
  private uView!: WebGLUniformLocation;
  private vao!: WebGLVertexArrayObject;
  private buffer!: WebGLBuffer;
  private count = 0;

  init(gl: WebGL2RenderingContext) {
    this.prog = link(gl, compile(gl, gl.VERTEX_SHADER, VS), compile(gl, gl.FRAGMENT_SHADER, FS));
    this.uProj = gl.getUniformLocation(this.prog, "uProj")!;
    this.uView = gl.getUniformLocation(this.prog, "uView")!;

    const strands = 64;
    const segs = 128;
    const data = new Float32Array(strands * segs * 3);
    let idx = 0;
    for (let s = 0; s < strands; s++) {
      let x = (Math.random() - 0.5) * 120;
      let y = (Math.random() - 0.5) * 60;
      let z = (Math.random() - 0.5) * 120;
      let vx = 0;
      let vy = 0;
      let vz = 0;
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const ax = Math.sin(t * 9.0 + s * 0.3) * 0.8;
        const ay = Math.cos(t * 7.0 + s) * 0.6;
        const az = Math.sin(t * 5.0 + s * 0.7) * 0.7;
        vx = vx * 0.92 + ax;
        vy = vy * 0.92 + ay;
        vz = vz * 0.92 + az;
        x += vx;
        y += vy;
        z += vz;
        data[idx++] = x;
        data[idx++] = y;
        data[idx++] = z;
      }
    }
    this.count = strands * segs;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  draw(gl: WebGL2RenderingContext, camera: { proj: Float32Array; view: Float32Array }) {
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.uProj, false, camera.proj);
    gl.uniformMatrix4fv(this.uView, false, camera.view);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.LINE_STRIP, 0, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  dispose(gl: WebGL2RenderingContext) {
    deleteProgram(gl, this.prog);
    deleteVertexArray(gl, this.vao);
    deleteBuffer(gl, this.buffer);
  }
}
