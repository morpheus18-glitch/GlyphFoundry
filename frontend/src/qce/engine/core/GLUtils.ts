export function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info || "unknown"}`);
  }
  return shader;
}

export function link(gl: WebGL2RenderingContext, ...shaders: WebGLShader[]): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  shaders.forEach((shader) => gl.attachShader(program, shader));
  gl.linkProgram(program);
  shaders.forEach((shader) => gl.detachShader(program, shader));
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info || "unknown"}`);
  }
  return program;
}

export function deleteProgram(gl: WebGL2RenderingContext, program?: WebGLProgram | null) {
  if (program) gl.deleteProgram(program);
}

export function deleteBuffer(gl: WebGL2RenderingContext, buffer?: WebGLBuffer | null) {
  if (buffer) gl.deleteBuffer(buffer);
}

export function deleteVertexArray(gl: WebGL2RenderingContext, vao?: WebGLVertexArrayObject | null) {
  if (vao) gl.deleteVertexArray(vao);
}

export function deleteTexture(gl: WebGL2RenderingContext, texture?: WebGLTexture | null) {
  if (texture) gl.deleteTexture(texture);
}

export function deleteRenderbuffer(gl: WebGL2RenderingContext, buffer?: WebGLRenderbuffer | null) {
  if (buffer) gl.deleteRenderbuffer(buffer);
}
