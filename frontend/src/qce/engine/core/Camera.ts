const DEG2RAD = Math.PI / 180;

function normalize(out: Float32Array, v: Float32Array) {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  let len = Math.hypot(x, y, z);
  if (len === 0) len = 1;
  const inv = 1 / len;
  out[0] = x * inv;
  out[1] = y * inv;
  out[2] = z * inv;
}

function subtract(out: Float32Array, a: Float32Array, b: Float32Array) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
}

function cross(out: Float32Array, a: Float32Array, b: Float32Array) {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
}

function perspective(out: Float32Array, fov: number, aspect: number, near: number, far: number) {
  const f = 1.0 / Math.tan((fov * DEG2RAD) / 2);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[11] = -1;

  if (far !== Infinity) {
    const nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }

  out[12] = 0;
  out[13] = 0;
  out[15] = 0;
}

function lookAt(out: Float32Array, eye: Float32Array, center: Float32Array, up: Float32Array) {
  const xAxis = new Float32Array(3);
  const yAxis = new Float32Array(3);
  const zAxis = new Float32Array(3);

  subtract(zAxis, eye, center);
  normalize(zAxis, zAxis);

  cross(xAxis, up, zAxis);
  normalize(xAxis, xAxis);

  cross(yAxis, zAxis, xAxis);

  out[0] = xAxis[0];
  out[1] = yAxis[0];
  out[2] = zAxis[0];
  out[3] = 0;

  out[4] = xAxis[1];
  out[5] = yAxis[1];
  out[6] = zAxis[1];
  out[7] = 0;

  out[8] = xAxis[2];
  out[9] = yAxis[2];
  out[10] = zAxis[2];
  out[11] = 0;

  out[12] = -(xAxis[0] * eye[0] + xAxis[1] * eye[1] + xAxis[2] * eye[2]);
  out[13] = -(yAxis[0] * eye[0] + yAxis[1] * eye[1] + yAxis[2] * eye[2]);
  out[14] = -(zAxis[0] * eye[0] + zAxis[1] * eye[1] + zAxis[2] * eye[2]);
  out[15] = 1;
}

export class CinematicCamera {
  proj = new Float32Array(16);
  view = new Float32Array(16);
  position = new Float32Array([0, 40, 420]);
  target = new Float32Array([0, 0, 0]);
  up = new Float32Array([0, 1, 0]);
  private aspect = 1;
  private radius = 420;
  private theta = 0;

  constructor() {
    this.setPerspective(45, 1, 0.1, 4000);
    this.updateView();
  }

  setPerspective(fov: number, aspect: number, near: number, far: number) {
    this.aspect = aspect;
    perspective(this.proj, fov, aspect, near, far);
  }

  setViewport(width: number, height: number) {
    const aspect = height === 0 ? 1 : width / height;
    this.setPerspective(45, aspect, 0.1, 4000);
  }

  setRadius(radius: number) {
    this.radius = radius;
  }

  update(dt: number) {
    this.theta += dt * 0.25;
    const orbitX = Math.cos(this.theta) * this.radius;
    const orbitZ = Math.sin(this.theta) * this.radius;
    const vertical = Math.sin(this.theta * 0.45) * this.radius * 0.18 + 60;
    this.position[0] = orbitX;
    this.position[1] = vertical;
    this.position[2] = orbitZ;
    this.updateView();
  }

  private updateView() {
    lookAt(this.view, this.position, this.target, this.up);
  }
}
