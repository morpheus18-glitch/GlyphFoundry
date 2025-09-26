import { compile, deleteBuffer, deleteProgram, deleteVertexArray } from "../core/GLUtils";

const UPDATE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 i_pos;
layout(location=1) in vec3 i_vel;
uniform float uTime;
uniform float uDelta;
out vec3 o_pos;
out vec3 o_vel;

vec3 swirl(vec3 p, float time) {
  float angle = time * 0.25;
  mat3 rot = mat3(
    cos(angle), 0.0, -sin(angle),
    0.0,        1.0, 0.0,
    sin(angle), 0.0, cos(angle)
  );
  return rot * p;
}

void main() {
  vec3 pos = i_pos;
  vec3 vel = i_vel;

  vec3 toward = normalize(-pos + vec3(0.0, sin(uTime * 0.4) * 40.0, 0.0));
  vec3 swirlForce = normalize(swirl(pos, uTime) - pos + vec3(0.0, 0.2, 0.0));
  if (!all(greaterThan(toward * toward, vec3(0.0)))) {
    toward = vec3(0.0, 1.0, 0.0);
  }

  float speed = length(vel);
  vel += (toward * 0.7 + swirlForce * 0.3) * uDelta * 90.0;
  vel -= vel * min(1.0, uDelta * 1.6);
  vel += vec3(
    sin(uTime + pos.y * 0.01),
    cos(uTime * 0.8 + pos.x * 0.01),
    sin(uTime * 0.6 + pos.z * 0.01)
  ) * 0.08 * uDelta;

  pos += vel * uDelta * 60.0;

  float radius = length(pos.xz);
  if (radius > 480.0) {
    vec3 dir = pos / max(radius, 0.001);
    pos -= dir * (radius - 480.0);
    vel -= dir * speed * 0.6;
  }

  if (pos.y > 260.0) {
    pos.y = 260.0;
    vel.y *= -0.2;
  }
  if (pos.y < -260.0) {
    pos.y = -260.0;
    vel.y *= -0.2;
  }

  o_pos = pos;
  o_vel = vel;
}`;

export type ParticleBuffer = {
  vao: WebGLVertexArrayObject;
  position: WebGLBuffer;
  velocity: WebGLBuffer;
};

export class TFParticleSim {
  private gl: WebGL2RenderingContext;
  readonly count: number;
  private updateProgram: WebGLProgram;
  private read: ParticleBuffer;
  private write: ParticleBuffer;
  private feedback: WebGLTransformFeedback;
  private uTime: WebGLUniformLocation;
  private uDelta: WebGLUniformLocation;

  constructor(gl: WebGL2RenderingContext, count = 400_000) {
    this.gl = gl;
    this.count = count;
    const vs = compile(gl, gl.VERTEX_SHADER, UPDATE_VS);
    this.updateProgram = gl.createProgram()!;
    gl.attachShader(this.updateProgram, vs);
    gl.transformFeedbackVaryings(this.updateProgram, ["o_pos", "o_vel"], gl.SEPARATE_ATTRIBS);
    gl.linkProgram(this.updateProgram);
    gl.deleteShader(vs);
    if (!gl.getProgramParameter(this.updateProgram, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.updateProgram);
      gl.deleteProgram(this.updateProgram);
      throw new Error(`Particle update program link error: ${info || "unknown"}`);
    }
    this.uTime = gl.getUniformLocation(this.updateProgram, "uTime")!;
    this.uDelta = gl.getUniformLocation(this.updateProgram, "uDelta")!;

    this.read = this.createBuffers();
    this.write = this.createBuffers();
    this.feedback = gl.createTransformFeedback()!;
  }

  private createBuffers(): ParticleBuffer {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const position = gl.createBuffer()!;
    const velocity = gl.createBuffer()!;

    const posData = new Float32Array(this.count * 3);
    const velData = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      const r = Math.random() * 320;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 180;
      posData[i * 3 + 0] = Math.cos(theta) * r;
      posData[i * 3 + 1] = y;
      posData[i * 3 + 2] = Math.sin(theta) * r;
      velData[i * 3 + 0] = (Math.random() - 0.5) * 2;
      velData[i * 3 + 1] = (Math.random() - 0.5) * 2;
      velData[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.bufferData(gl.ARRAY_BUFFER, posData, gl.DYNAMIC_COPY);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, velocity);
    gl.bufferData(gl.ARRAY_BUFFER, velData, gl.DYNAMIC_COPY);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return { vao, position, velocity };
  }

  update(time: number, delta: number) {
    const gl = this.gl;
    gl.useProgram(this.updateProgram);
    gl.uniform1f(this.uTime, time);
    gl.uniform1f(this.uDelta, delta);

    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(this.read.vao);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.write.position);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.write.velocity);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.endTransformFeedback();

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
    gl.bindVertexArray(null);
    gl.disable(gl.RASTERIZER_DISCARD);

    const tmp = this.read;
    this.read = this.write;
    this.write = tmp;
  }

  get readBuffer() {
    return this.read;
  }

  dispose() {
    const gl = this.gl;
    deleteVertexArray(gl, this.read.vao);
    deleteBuffer(gl, this.read.position);
    deleteBuffer(gl, this.read.velocity);
    deleteVertexArray(gl, this.write.vao);
    deleteBuffer(gl, this.write.position);
    deleteBuffer(gl, this.write.velocity);
    gl.deleteTransformFeedback(this.feedback);
    deleteProgram(gl, this.updateProgram);
  }
}
