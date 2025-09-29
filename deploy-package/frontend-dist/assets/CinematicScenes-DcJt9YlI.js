import{r as m,j as d}from"./index-Bv0osFNW.js";const S=Math.PI/180;function F(r,e){const i=e[0],t=e[1],s=e[2];let o=Math.hypot(i,t,s);o===0&&(o=1);const a=1/o;r[0]=i*a,r[1]=t*a,r[2]=s*a}function y(r,e,i){r[0]=e[0]-i[0],r[1]=e[1]-i[1],r[2]=e[2]-i[2]}function x(r,e,i){const t=e[0],s=e[1],o=e[2],a=i[0],n=i[1],c=i[2];r[0]=s*c-o*n,r[1]=o*a-t*c,r[2]=t*n-s*a}function V(r,e,i,t,s){const o=1/Math.tan(e*S/2);if(r[0]=o/i,r[1]=0,r[2]=0,r[3]=0,r[4]=0,r[5]=o,r[6]=0,r[7]=0,r[8]=0,r[9]=0,r[11]=-1,s!==1/0){const a=1/(t-s);r[10]=(s+t)*a,r[14]=2*s*t*a}else r[10]=-1,r[14]=-2*t;r[12]=0,r[13]=0,r[15]=0}function B(r,e,i,t){const s=new Float32Array(3),o=new Float32Array(3),a=new Float32Array(3);y(a,e,i),F(a,a),x(s,t,a),F(s,s),x(o,a,s),r[0]=s[0],r[1]=o[0],r[2]=a[0],r[3]=0,r[4]=s[1],r[5]=o[1],r[6]=a[1],r[7]=0,r[8]=s[2],r[9]=o[2],r[10]=a[2],r[11]=0,r[12]=-(s[0]*e[0]+s[1]*e[1]+s[2]*e[2]),r[13]=-(o[0]*e[0]+o[1]*e[1]+o[2]*e[2]),r[14]=-(a[0]*e[0]+a[1]*e[1]+a[2]*e[2]),r[15]=1}class D{constructor(){this.proj=new Float32Array(16),this.view=new Float32Array(16),this.position=new Float32Array([0,40,420]),this.target=new Float32Array([0,0,0]),this.up=new Float32Array([0,1,0]),this.aspect=1,this.radius=420,this.theta=0,this.setPerspective(45,1,.1,4e3),this.updateView()}setPerspective(e,i,t,s){this.aspect=i,V(this.proj,e,i,t,s)}setViewport(e,i){const t=i===0?1:e/i;this.setPerspective(45,t,.1,4e3)}setRadius(e){this.radius=e}update(e){this.theta+=e*.25;const i=Math.cos(this.theta)*this.radius,t=Math.sin(this.theta)*this.radius,s=Math.sin(this.theta*.45)*this.radius*.18+60;this.position[0]=i,this.position[1]=s,this.position[2]=t,this.updateView()}updateView(){B(this.view,this.position,this.target,this.up)}}function f(r,e,i){const t=r.createShader(e);if(!t)throw new Error("Failed to create shader");if(r.shaderSource(t,i),r.compileShader(t),!r.getShaderParameter(t,r.COMPILE_STATUS)){const s=r.getShaderInfoLog(t);throw r.deleteShader(t),new Error(`Shader compile error: ${s||"unknown"}`)}return t}function A(r,...e){const i=r.createProgram();if(!i)throw new Error("Failed to create program");if(e.forEach(t=>r.attachShader(i,t)),r.linkProgram(i),e.forEach(t=>r.detachShader(i,t)),!r.getProgramParameter(i,r.LINK_STATUS)){const t=r.getProgramInfoLog(i);throw r.deleteProgram(i),new Error(`Program link error: ${t||"unknown"}`)}return i}function p(r,e){e&&r.deleteProgram(e)}function l(r,e){e&&r.deleteBuffer(e)}function E(r,e){e&&r.deleteVertexArray(e)}function M(r,e){e&&r.deleteTexture(e)}function L(r,e){e&&r.deleteRenderbuffer(e)}const U=`#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 vUV;
void main(){
  vUV = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,N=`#version 300 es
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
  const vec3 a = x * (x + 0.0245786) - 0.000090537;
  const vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081;
  vec3 c = a / b;
  c = ACESOutputMat * c;
  return clamp(c, 0.0, 1.0);
}

void main(){
  vec3 hdr = texture(uColor, vUV).rgb * uExposure;
  vec3 col = aces(hdr);
  frag = vec4(col, 1.0);
}`;class g{constructor(e){this.width=1,this.height=1,this.framebuffer=null,this.color=null,this.depth=null,this.vao=null,this.program=null,this.uExposure=null,this.gl=e,this.setupProgram(),this.resize(e.canvas.width||1,e.canvas.height||1)}setupProgram(){const e=this.gl,i=f(e,e.VERTEX_SHADER,U),t=f(e,e.FRAGMENT_SHADER,N);this.program=A(e,i,t),this.uExposure=e.getUniformLocation(this.program,"uExposure"),e.deleteShader(i),e.deleteShader(t),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao);const s=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,s),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null)}resize(e,i){const t=this.gl;if(e===this.width&&i===this.height)return;this.width=Math.max(1,Math.floor(e)),this.height=Math.max(1,Math.floor(i)),this.framebuffer||(this.framebuffer=t.createFramebuffer()),t.bindFramebuffer(t.FRAMEBUFFER,this.framebuffer),this.color||(this.color=t.createTexture()),t.bindTexture(t.TEXTURE_2D,this.color),t.texImage2D(t.TEXTURE_2D,0,t.RGBA16F,this.width,this.height,0,t.RGBA,t.FLOAT,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.color,0),this.depth||(this.depth=t.createRenderbuffer()),t.bindRenderbuffer(t.RENDERBUFFER,this.depth),t.renderbufferStorage(t.RENDERBUFFER,t.DEPTH_COMPONENT24,this.width,this.height),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.DEPTH_ATTACHMENT,t.RENDERBUFFER,this.depth);const s=t.checkFramebufferStatus(t.FRAMEBUFFER);if(s!==t.FRAMEBUFFER_COMPLETE)throw new Error(`HDR framebuffer incomplete: 0x${s.toString(16)}`);t.bindFramebuffer(t.FRAMEBUFFER,null)}bindHDR(){const e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,this.framebuffer),e.viewport(0,0,this.width,this.height)}resolve(e=1.1){const i=this.gl;i.bindFramebuffer(i.FRAMEBUFFER,null),i.viewport(0,0,i.drawingBufferWidth,i.drawingBufferHeight),i.disable(i.DEPTH_TEST),i.useProgram(this.program),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,this.color),i.uniform1f(this.uExposure,e),i.bindVertexArray(this.vao),i.drawArrays(i.TRIANGLES,0,3),i.bindVertexArray(null),i.enable(i.DEPTH_TEST)}dispose(){const e=this.gl;this.framebuffer&&e.deleteFramebuffer(this.framebuffer),M(e,this.color),L(e,this.depth),this.vao&&e.deleteVertexArray(this.vao),p(e,this.program)}}const C=`#version 300 es
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
}`;class z{constructor(e,i=4e5){this.gl=e,this.count=i;const t=f(e,e.VERTEX_SHADER,C);if(this.updateProgram=e.createProgram(),e.attachShader(this.updateProgram,t),e.transformFeedbackVaryings(this.updateProgram,["o_pos","o_vel"],e.SEPARATE_ATTRIBS),e.linkProgram(this.updateProgram),e.deleteShader(t),!e.getProgramParameter(this.updateProgram,e.LINK_STATUS)){const s=e.getProgramInfoLog(this.updateProgram);throw e.deleteProgram(this.updateProgram),new Error(`Particle update program link error: ${s||"unknown"}`)}this.uTime=e.getUniformLocation(this.updateProgram,"uTime"),this.uDelta=e.getUniformLocation(this.updateProgram,"uDelta"),this.read=this.createBuffers(),this.write=this.createBuffers(),this.feedback=e.createTransformFeedback()}createBuffers(){const e=this.gl,i=e.createVertexArray();e.bindVertexArray(i);const t=e.createBuffer(),s=e.createBuffer(),o=new Float32Array(this.count*3),a=new Float32Array(this.count*3);for(let n=0;n<this.count;n++){const c=Math.random()*320,h=Math.random()*Math.PI*2,u=(Math.random()-.5)*180;o[n*3+0]=Math.cos(h)*c,o[n*3+1]=u,o[n*3+2]=Math.sin(h)*c,a[n*3+0]=(Math.random()-.5)*2,a[n*3+1]=(Math.random()-.5)*2,a[n*3+2]=(Math.random()-.5)*2}return e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,o,e.DYNAMIC_COPY),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,s),e.bufferData(e.ARRAY_BUFFER,a,e.DYNAMIC_COPY),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0),e.bindVertexArray(null),e.bindBuffer(e.ARRAY_BUFFER,null),{vao:i,position:t,velocity:s}}update(e,i){const t=this.gl;t.useProgram(this.updateProgram),t.uniform1f(this.uTime,e),t.uniform1f(this.uDelta,i),t.enable(t.RASTERIZER_DISCARD),t.bindVertexArray(this.read.vao),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,this.feedback),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,this.write.position),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,this.write.velocity),t.beginTransformFeedback(t.POINTS),t.drawArrays(t.POINTS,0,this.count),t.endTransformFeedback(),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,null),t.bindVertexArray(null),t.disable(t.RASTERIZER_DISCARD);const s=this.read;this.read=this.write,this.write=s}get readBuffer(){return this.read}dispose(){const e=this.gl;E(e,this.read.vao),l(e,this.read.position),l(e,this.read.velocity),E(e,this.write.vao),l(e,this.write.position),l(e,this.write.velocity),e.deleteTransformFeedback(this.feedback),p(e,this.updateProgram)}}class I{constructor(e){this.scenes={},this.gl=e}register(e){this.scenes[e.name]=e}use(e){var t,s;if(((t=this.current)==null?void 0:t.name)===e)return;const i=this.scenes[e];if(!i)throw new Error(`Scene not found: ${e}`);(s=this.current)!=null&&s.dispose&&this.current.dispose(this.gl),i.init(this.gl),this.current=i}resize(){var e,i;(i=(e=this.current)==null?void 0:e.resize)==null||i.call(e,this.gl)}draw(e,i,t){this.current&&this.current.draw(this.gl,e,i,t)}disposeAll(){Object.values(this.scenes).forEach(e=>{var i;(i=e.dispose)==null||i.call(e,this.gl)})}}const O=`#version 300 es
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
`,j=`#version 300 es
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
`,k=`#version 300 es
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
`,H=`#version 300 es
precision highp float;
in float vFade;
out vec4 frag;
void main(){
  vec3 cyan = vec3(0.169,0.894,0.953);
  vec3 ember = vec3(1.0,0.431,0.227);
  vec3 col = mix(cyan, ember, vFade*0.9);
  frag = vec4(col, vFade);
}
`;class X{constructor(){this.name="NeuralConstellation",this.countPoints=12e4,this.countLines=4e4}init(e){this.progPoints=A(e,f(e,e.VERTEX_SHADER,O),f(e,e.FRAGMENT_SHADER,j)),this.uProjP=e.getUniformLocation(this.progPoints,"uProj"),this.uViewP=e.getUniformLocation(this.progPoints,"uView"),this.uSize=e.getUniformLocation(this.progPoints,"uSize"),this.progLines=A(e,f(e,e.VERTEX_SHADER,k),f(e,e.FRAGMENT_SHADER,H)),this.uProjL=e.getUniformLocation(this.progLines,"uProj"),this.uViewL=e.getUniformLocation(this.progLines,"uView");const i=new Float32Array(this.countPoints*3);for(let o=0;o<this.countPoints;o++){const a=o/this.countPoints,n=2.39996323*o,c=90*Math.sqrt(a);i[o*3+0]=Math.cos(n)*c*(Math.random()*.3+.7),i[o*3+1]=(Math.random()-.5)*90,i[o*3+2]=Math.sin(n)*c*(Math.random()*.3+.7)}this.vaoPoints=e.createVertexArray(),e.bindVertexArray(this.vaoPoints),this.pointsBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.pointsBuffer),e.bufferData(e.ARRAY_BUFFER,i,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindVertexArray(null);const t=new Float32Array(this.countLines*3),s=new Float32Array(this.countLines*3);for(let o=0;o<this.countLines;o++){const a=Math.random()*this.countPoints|0,n=(a+(Math.random()*400|0))%this.countPoints;t[o*3+0]=i[a*3+0],t[o*3+1]=i[a*3+1],t[o*3+2]=i[a*3+2],s[o*3+0]=i[n*3+0],s[o*3+1]=i[n*3+1],s[o*3+2]=i[n*3+2]}this.vaoLines=e.createVertexArray(),e.bindVertexArray(this.vaoLines),this.lineSrcBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.lineSrcBuffer),e.bufferData(e.ARRAY_BUFFER,t,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),this.lineDstBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.lineDstBuffer),e.bufferData(e.ARRAY_BUFFER,s,e.STATIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0),e.bindVertexArray(null)}draw(e,i,t){e.useProgram(this.progLines),e.uniformMatrix4fv(this.uProjL,!1,i.proj),e.uniformMatrix4fv(this.uViewL,!1,i.view),e.bindVertexArray(this.vaoLines),e.drawArrays(e.LINES,0,this.countLines*2),e.bindVertexArray(null),e.useProgram(this.progPoints),e.uniformMatrix4fv(this.uProjP,!1,i.proj),e.uniformMatrix4fv(this.uViewP,!1,i.view),e.uniform1f(this.uSize,1.6+Math.sin(t*.4)*.2),e.bindVertexArray(this.vaoPoints),e.drawArrays(e.POINTS,0,this.countPoints),e.bindVertexArray(null)}dispose(e){p(e,this.progPoints),p(e,this.progLines),E(e,this.vaoPoints),E(e,this.vaoLines),l(e,this.pointsBuffer),l(e,this.lineSrcBuffer),l(e,this.lineDstBuffer)}}const Y=`#version 300 es
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
`,G=`#version 300 es
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
`;class W{constructor(e){this.name="ParticleVortex",this.tf=e}init(e){this.prog=A(e,f(e,e.VERTEX_SHADER,Y),f(e,e.FRAGMENT_SHADER,G)),this.uProj=e.getUniformLocation(this.prog,"uProj"),this.uView=e.getUniformLocation(this.prog,"uView"),this.uSize=e.getUniformLocation(this.prog,"uSize")}draw(e,i,t){const s=1.2+Math.sin(t*.6)*.2;e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE),e.useProgram(this.prog),e.uniformMatrix4fv(this.uProj,!1,i.proj),e.uniformMatrix4fv(this.uView,!1,i.view),e.uniform1f(this.uSize,s),e.bindVertexArray(this.tf.readBuffer.vao),e.drawArrays(e.POINTS,0,this.tf.count),e.bindVertexArray(null),e.disable(e.BLEND)}dispose(e){p(e,this.prog)}}const $=`#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 vUV;
void main(){ vUV = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }`,K=`#version 300 es
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
`;class q{constructor(){this.name="QuantumWavefield"}init(e){this.prog=A(e,f(e,e.VERTEX_SHADER,$),f(e,e.FRAGMENT_SHADER,K)),this.uTime=e.getUniformLocation(this.prog,"uTime"),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),this.vbo=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null)}draw(e,i,t){e.useProgram(this.prog),e.uniform1f(this.uTime,t),e.bindVertexArray(this.vao),e.drawArrays(e.TRIANGLES,0,3),e.bindVertexArray(null)}dispose(e){p(e,this.prog),E(e,this.vao),l(e,this.vbo)}}const Q=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
uniform mat4 uProj, uView;
out vec3 vPos;
void main(){
  vec4 mv = uView * vec4(a_pos,1.0);
  gl_Position = uProj * mv;
  vPos = a_pos;
}
`,Z=`#version 300 es
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
`;class J{constructor(){this.name="VolumetricSpines",this.count=0}init(e){this.prog=A(e,f(e,e.VERTEX_SHADER,Q),f(e,e.FRAGMENT_SHADER,Z)),this.uProj=e.getUniformLocation(this.prog,"uProj"),this.uView=e.getUniformLocation(this.prog,"uView");const i=64,t=128,s=new Float32Array(i*t*3);let o=0;for(let a=0;a<i;a++){let n=(Math.random()-.5)*120,c=(Math.random()-.5)*60,h=(Math.random()-.5)*120,u=0,v=0,b=0;for(let R=0;R<t;R++){const w=R/t,T=Math.sin(w*9+a*.3)*.8,P=Math.cos(w*7+a)*.6,_=Math.sin(w*5+a*.7)*.7;u=u*.92+T,v=v*.92+P,b=b*.92+_,n+=u,c+=v,h+=b,s[o++]=n,s[o++]=c,s[o++]=h}}this.count=i*t,this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),this.buffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.buffer),e.bufferData(e.ARRAY_BUFFER,s,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindVertexArray(null)}draw(e,i){e.enable(e.BLEND),e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE_MINUS_SRC_ALPHA),e.useProgram(this.prog),e.uniformMatrix4fv(this.uProj,!1,i.proj),e.uniformMatrix4fv(this.uView,!1,i.view),e.bindVertexArray(this.vao),e.drawArrays(e.LINE_STRIP,0,this.count),e.bindVertexArray(null),e.disable(e.BLEND)}dispose(e){p(e,this.prog),E(e,this.vao),l(e,this.buffer)}}class ee{constructor(e){this.running=!1,this.animationFrame=null,this.lastTime=0,this.time=0,this.loop=i=>{if(!this.running)return;const t=(i-this.lastTime)/1e3;this.lastTime=i;const s=Math.min(t,1/15);this.time+=s,this.camera.update(s),this.tfSim.update(this.time,s);const o=this.gl;this.pipeline.bindHDR(),o.clearColor(.043,.055,.063,1),o.clear(o.COLOR_BUFFER_BIT|o.DEPTH_BUFFER_BIT),this.scenes.draw(this.camera,this.time,s),this.pipeline.resolve(1.15),this.animationFrame=requestAnimationFrame(this.loop)},this.resize=()=>{if(!this.gl)return;const i=Math.min(window.devicePixelRatio||1,1.75),t=this.canvas.clientWidth*i,s=this.canvas.clientHeight*i;!t||!s||(this.canvas.width=Math.floor(t),this.canvas.height=Math.floor(s),this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.pipeline.resize(this.canvas.width,this.canvas.height),this.camera.setViewport(this.canvas.width,this.canvas.height),this.scenes.resize())},this.handleResize=()=>{this.resize()},this.canvas=e}start(){const e=this.canvas.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"high-performance"});if(!e)throw new Error("WebGL2 not supported");this.gl=e,e.enable(e.DEPTH_TEST),e.depthFunc(e.LEQUAL),e.disable(e.CULL_FACE),this.pipeline=new g(e),this.camera=new D,this.tfSim=new z(e),this.scenes=new I(e),this.scenes.register(new X),this.scenes.register(new q),this.scenes.register(new J),this.scenes.register(new W(this.tfSim)),this.resize(),window.addEventListener("resize",this.handleResize),this.running=!0,this.lastTime=performance.now(),this.time=0,this.setScene("NeuralConstellation"),this.animationFrame=requestAnimationFrame(this.loop)}setScene(e){this.scenes&&this.scenes.use(e)}dispose(){var e,i,t;this.running=!1,this.animationFrame!==null&&cancelAnimationFrame(this.animationFrame),window.removeEventListener("resize",this.handleResize),(e=this.scenes)==null||e.disposeAll(),(i=this.tfSim)==null||i.dispose(),(t=this.pipeline)==null||t.dispose()}}const te=["NeuralConstellation","QuantumWavefield","VolumetricSpines","ParticleVortex"];function re(){const r=m.useRef(null),e=m.useRef(null),i=m.useRef(null),[t,s]=m.useState("NeuralConstellation"),[o,a]=m.useState(null);m.useEffect(()=>{const c=e.current;if(c)try{const h=new ee(c);i.current=h,h.start(),h.setScene(t);const u=()=>h.resize();u();const v=typeof ResizeObserver<"u"?new ResizeObserver(u):null;return v&&r.current?v.observe(r.current):window.addEventListener("resize",u),()=>{v?v.disconnect():window.removeEventListener("resize",u),h.dispose(),i.current=null}}catch(h){a((h==null?void 0:h.message)||"Unable to start cinematic engine")}},[]),m.useEffect(()=>{var c;(c=i.current)==null||c.setScene(t)},[t]);const n=m.useMemo(()=>te.map(c=>d.jsx("button",{onClick:()=>s(c),className:`px-3 py-1.5 text-xs uppercase tracking-[0.2em] rounded transition-colors border ${t===c?"border-white/70 bg-white/10 text-white":"border-white/10 bg-black/30 text-white/70 hover:text-white hover:border-white/40"}`,type:"button",children:c.replace(/([a-z])([A-Z])/g,"$1 $2")},c)),[t]);return d.jsxs("div",{ref:r,className:"relative h-full w-full overflow-hidden bg-black",children:[d.jsx("canvas",{ref:e,className:"h-full w-full"}),d.jsx("div",{className:"pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"}),d.jsx("div",{className:"pointer-events-auto absolute top-4 left-4 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur",children:n}),d.jsxs("div",{className:"pointer-events-none absolute bottom-4 left-4 max-w-sm rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/80 backdrop-blur",children:[d.jsx("p",{className:"font-semibold uppercase tracking-[0.3em] text-white/70",children:"Cinematic Neural Atlas"}),d.jsx("p",{className:"mt-2 leading-relaxed text-white/70",children:"Explore four shader-driven narratives rendered in HDR: constellations of thought, quantum interference, volumetric spines, and a transform-feedback particle vortex."})]}),o&&d.jsx("div",{className:"pointer-events-auto absolute bottom-4 right-4 max-w-xs rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs text-red-200",children:o})]})}export{re as default};
