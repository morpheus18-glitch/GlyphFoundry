import{r as p,j as m}from"./index-DXUXQJQI.js";const S=Math.PI/180;function x(s,e){const r=e[0],t=e[1],i=e[2];let a=Math.hypot(r,t,i);a===0&&(a=1);const o=1/a;s[0]=r*o,s[1]=t*o,s[2]=i*o}function D(s,e,r){s[0]=e[0]-r[0],s[1]=e[1]-r[1],s[2]=e[2]-r[2]}function P(s,e,r){const t=e[0],i=e[1],a=e[2],o=r[0],n=r[1],c=r[2];s[0]=i*c-a*n,s[1]=a*o-t*c,s[2]=t*n-i*o}function B(s,e,r,t,i){const a=1/Math.tan(e*S/2);if(s[0]=a/r,s[1]=0,s[2]=0,s[3]=0,s[4]=0,s[5]=a,s[6]=0,s[7]=0,s[8]=0,s[9]=0,s[11]=-1,i!==1/0){const o=1/(t-i);s[10]=(i+t)*o,s[14]=2*i*t*o}else s[10]=-1,s[14]=-2*t;s[12]=0,s[13]=0,s[15]=0}function M(s,e,r,t){const i=new Float32Array(3),a=new Float32Array(3),o=new Float32Array(3);D(o,e,r),x(o,o),P(i,t,o),x(i,i),P(a,o,i),s[0]=i[0],s[1]=a[0],s[2]=o[0],s[3]=0,s[4]=i[1],s[5]=a[1],s[6]=o[1],s[7]=0,s[8]=i[2],s[9]=a[2],s[10]=o[2],s[11]=0,s[12]=-(i[0]*e[0]+i[1]*e[1]+i[2]*e[2]),s[13]=-(a[0]*e[0]+a[1]*e[1]+a[2]*e[2]),s[14]=-(o[0]*e[0]+o[1]*e[1]+o[2]*e[2]),s[15]=1}class V{constructor(){this.proj=new Float32Array(16),this.view=new Float32Array(16),this.position=new Float32Array([0,40,420]),this.target=new Float32Array([0,0,0]),this.up=new Float32Array([0,1,0]),this.aspect=1,this.radius=420,this.theta=0,this.setPerspective(45,1,.1,4e3),this.updateView()}setPerspective(e,r,t,i){this.aspect=r,B(this.proj,e,r,t,i)}setViewport(e,r){const t=r===0?1:e/r;this.setPerspective(45,t,.1,4e3)}setRadius(e){this.radius=e}update(e){this.theta+=e*.25;const r=Math.cos(this.theta)*this.radius,t=Math.sin(this.theta)*this.radius,i=Math.sin(this.theta*.45)*this.radius*.18+60;this.position[0]=r,this.position[1]=i,this.position[2]=t,this.updateView()}updateView(){M(this.view,this.position,this.target,this.up)}}function u(s,e,r){const t=s.createShader(e);if(!t)throw new Error("Failed to create shader");if(s.shaderSource(t,r),s.compileShader(t),!s.getShaderParameter(t,s.COMPILE_STATUS)){const i=s.getShaderInfoLog(t);throw s.deleteShader(t),new Error(`Shader compile error: ${i||"unknown"}`)}return t}function b(s,...e){const r=s.createProgram();if(!r)throw new Error("Failed to create program");if(e.forEach(t=>s.attachShader(r,t)),s.linkProgram(r),e.forEach(t=>s.detachShader(r,t)),!s.getProgramParameter(r,s.LINK_STATUS)){const t=s.getProgramInfoLog(r);throw s.deleteProgram(r),new Error(`Program link error: ${t||"unknown"}`)}return r}function A(s,e){e&&s.deleteProgram(e)}function v(s,e){e&&s.deleteBuffer(e)}function F(s,e){e&&s.deleteVertexArray(e)}function y(s,e){e&&s.deleteTexture(e)}function U(s,e){e&&s.deleteRenderbuffer(e)}const L=`#version 300 es
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
}`;class C{constructor(e){this.width=1,this.height=1,this.framebuffer=null,this.color=null,this.depth=null,this.vao=null,this.program=null,this.uExposure=null,this.gl=e,this.setupProgram(),this.resize(e.canvas.width||1,e.canvas.height||1)}setupProgram(){const e=this.gl,r=u(e,e.VERTEX_SHADER,L),t=u(e,e.FRAGMENT_SHADER,N);this.program=b(e,r,t),this.uExposure=e.getUniformLocation(this.program,"uExposure"),e.deleteShader(r),e.deleteShader(t),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao);const i=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null)}resize(e,r){const t=this.gl;if(e===this.width&&r===this.height)return;this.width=Math.max(1,Math.floor(e)),this.height=Math.max(1,Math.floor(r)),this.framebuffer||(this.framebuffer=t.createFramebuffer()),t.bindFramebuffer(t.FRAMEBUFFER,this.framebuffer),this.color||(this.color=t.createTexture()),t.bindTexture(t.TEXTURE_2D,this.color),t.texImage2D(t.TEXTURE_2D,0,t.RGBA16F,this.width,this.height,0,t.RGBA,t.FLOAT,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.color,0),this.depth||(this.depth=t.createRenderbuffer()),t.bindRenderbuffer(t.RENDERBUFFER,this.depth),t.renderbufferStorage(t.RENDERBUFFER,t.DEPTH_COMPONENT24,this.width,this.height),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.DEPTH_ATTACHMENT,t.RENDERBUFFER,this.depth);const i=t.checkFramebufferStatus(t.FRAMEBUFFER);if(i!==t.FRAMEBUFFER_COMPLETE)throw new Error(`HDR framebuffer incomplete: 0x${i.toString(16)}`);t.bindFramebuffer(t.FRAMEBUFFER,null)}bindHDR(){const e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,this.framebuffer),e.viewport(0,0,this.width,this.height)}resolve(e=1.1){const r=this.gl;r.bindFramebuffer(r.FRAMEBUFFER,null),r.viewport(0,0,r.drawingBufferWidth,r.drawingBufferHeight),r.disable(r.DEPTH_TEST),r.useProgram(this.program),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.color),r.uniform1f(this.uExposure,e),r.bindVertexArray(this.vao),r.drawArrays(r.TRIANGLES,0,3),r.bindVertexArray(null),r.enable(r.DEPTH_TEST)}dispose(){const e=this.gl;this.framebuffer&&e.deleteFramebuffer(this.framebuffer),y(e,this.color),U(e,this.depth),this.vao&&e.deleteVertexArray(this.vao),A(e,this.program)}}const g=`#version 300 es
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
}`;class I{constructor(e,r=4e5){this.gl=e,this.count=r;const t=u(e,e.VERTEX_SHADER,g);if(this.updateProgram=e.createProgram(),e.attachShader(this.updateProgram,t),e.transformFeedbackVaryings(this.updateProgram,["o_pos","o_vel"],e.SEPARATE_ATTRIBS),e.linkProgram(this.updateProgram),e.deleteShader(t),!e.getProgramParameter(this.updateProgram,e.LINK_STATUS)){const i=e.getProgramInfoLog(this.updateProgram);throw e.deleteProgram(this.updateProgram),new Error(`Particle update program link error: ${i||"unknown"}`)}this.uTime=e.getUniformLocation(this.updateProgram,"uTime"),this.uDelta=e.getUniformLocation(this.updateProgram,"uDelta"),this.read=this.createBuffers(),this.write=this.createBuffers(),this.feedback=e.createTransformFeedback()}createBuffers(){const e=this.gl,r=e.createVertexArray();e.bindVertexArray(r);const t=e.createBuffer(),i=e.createBuffer(),a=new Float32Array(this.count*3),o=new Float32Array(this.count*3);for(let n=0;n<this.count;n++){const c=Math.random()*320,h=Math.random()*Math.PI*2,f=(Math.random()-.5)*180;a[n*3+0]=Math.cos(h)*c,a[n*3+1]=f,a[n*3+2]=Math.sin(h)*c,o[n*3+0]=(Math.random()-.5)*2,o[n*3+1]=(Math.random()-.5)*2,o[n*3+2]=(Math.random()-.5)*2}return e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,a,e.DYNAMIC_COPY),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,o,e.DYNAMIC_COPY),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0),e.bindVertexArray(null),e.bindBuffer(e.ARRAY_BUFFER,null),{vao:r,position:t,velocity:i}}update(e,r){const t=this.gl;t.useProgram(this.updateProgram),t.uniform1f(this.uTime,e),t.uniform1f(this.uDelta,r),t.enable(t.RASTERIZER_DISCARD),t.bindVertexArray(this.read.vao),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,this.feedback),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,this.write.position),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,this.write.velocity),t.beginTransformFeedback(t.POINTS),t.drawArrays(t.POINTS,0,this.count),t.endTransformFeedback(),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,null),t.bindVertexArray(null),t.disable(t.RASTERIZER_DISCARD);const i=this.read;this.read=this.write,this.write=i}get readBuffer(){return this.read}dispose(){const e=this.gl;F(e,this.read.vao),v(e,this.read.position),v(e,this.read.velocity),F(e,this.write.vao),v(e,this.write.position),v(e,this.write.velocity),e.deleteTransformFeedback(this.feedback),A(e,this.updateProgram)}}class z{constructor(e){this.scenes={},this.gl=e}register(e){this.scenes[e.name]=e}use(e){var t,i;if(((t=this.current)==null?void 0:t.name)===e)return;const r=this.scenes[e];if(!r)throw new Error(`Scene not found: ${e}`);(i=this.current)!=null&&i.dispose&&this.current.dispose(this.gl),r.init(this.gl),this.current=r}resize(){var e,r;(r=(e=this.current)==null?void 0:e.resize)==null||r.call(e,this.gl)}draw(e,r,t){this.current&&this.current.draw(this.gl,e,r,t)}disposeAll(){Object.values(this.scenes).forEach(e=>{var r;(r=e.dispose)==null||r.call(e,this.gl)})}}const O=`#version 300 es
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
`,H=`#version 300 es
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
`,j=`#version 300 es
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
`,k=`#version 300 es
precision highp float;
in float vFade;
out vec4 frag;
void main(){
  vec3 cyan = vec3(0.169,0.894,0.953);
  vec3 ember = vec3(1.0,0.431,0.227);
  vec3 col = mix(cyan, ember, vFade*0.9);
  frag = vec4(col, vFade);
}
`;class Y{constructor(){this.name="NeuralConstellation",this.countPoints=12e4,this.countLines=4e4}init(e){this.progPoints=b(e,u(e,e.VERTEX_SHADER,O),u(e,e.FRAGMENT_SHADER,H)),this.uProjP=e.getUniformLocation(this.progPoints,"uProj"),this.uViewP=e.getUniformLocation(this.progPoints,"uView"),this.uSize=e.getUniformLocation(this.progPoints,"uSize"),this.progLines=b(e,u(e,e.VERTEX_SHADER,j),u(e,e.FRAGMENT_SHADER,k)),this.uProjL=e.getUniformLocation(this.progLines,"uProj"),this.uViewL=e.getUniformLocation(this.progLines,"uView");const r=new Float32Array(this.countPoints*3);for(let a=0;a<this.countPoints;a++){const o=a/this.countPoints,n=2.39996323*a,c=90*Math.sqrt(o);r[a*3+0]=Math.cos(n)*c*(Math.random()*.3+.7),r[a*3+1]=(Math.random()-.5)*90,r[a*3+2]=Math.sin(n)*c*(Math.random()*.3+.7)}this.vaoPoints=e.createVertexArray(),e.bindVertexArray(this.vaoPoints),this.pointsBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.pointsBuffer),e.bufferData(e.ARRAY_BUFFER,r,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindVertexArray(null);const t=new Float32Array(this.countLines*3),i=new Float32Array(this.countLines*3);for(let a=0;a<this.countLines;a++){const o=Math.random()*this.countPoints|0,n=(o+(Math.random()*400|0))%this.countPoints;t[a*3+0]=r[o*3+0],t[a*3+1]=r[o*3+1],t[a*3+2]=r[o*3+2],i[a*3+0]=r[n*3+0],i[a*3+1]=r[n*3+1],i[a*3+2]=r[n*3+2]}this.vaoLines=e.createVertexArray(),e.bindVertexArray(this.vaoLines),this.lineSrcBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.lineSrcBuffer),e.bufferData(e.ARRAY_BUFFER,t,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),this.lineDstBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.lineDstBuffer),e.bufferData(e.ARRAY_BUFFER,i,e.STATIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0),e.bindVertexArray(null)}draw(e,r,t){e.useProgram(this.progLines),e.uniformMatrix4fv(this.uProjL,!1,r.proj),e.uniformMatrix4fv(this.uViewL,!1,r.view),e.bindVertexArray(this.vaoLines),e.drawArrays(e.LINES,0,this.countLines*2),e.bindVertexArray(null),e.useProgram(this.progPoints),e.uniformMatrix4fv(this.uProjP,!1,r.proj),e.uniformMatrix4fv(this.uViewP,!1,r.view),e.uniform1f(this.uSize,1.6+Math.sin(t*.4)*.2),e.bindVertexArray(this.vaoPoints),e.drawArrays(e.POINTS,0,this.countPoints),e.bindVertexArray(null)}dispose(e){A(e,this.progPoints),A(e,this.progLines),F(e,this.vaoPoints),F(e,this.vaoLines),v(e,this.pointsBuffer),v(e,this.lineSrcBuffer),v(e,this.lineDstBuffer)}}const X=`#version 300 es
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
`;class W{constructor(e){this.name="ParticleVortex",this.tf=e}init(e){this.prog=b(e,u(e,e.VERTEX_SHADER,X),u(e,e.FRAGMENT_SHADER,G)),this.uProj=e.getUniformLocation(this.prog,"uProj"),this.uView=e.getUniformLocation(this.prog,"uView"),this.uSize=e.getUniformLocation(this.prog,"uSize")}draw(e,r,t){const i=1.2+Math.sin(t*.6)*.2;e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE),e.useProgram(this.prog),e.uniformMatrix4fv(this.uProj,!1,r.proj),e.uniformMatrix4fv(this.uView,!1,r.view),e.uniform1f(this.uSize,i),e.bindVertexArray(this.tf.readBuffer.vao),e.drawArrays(e.POINTS,0,this.tf.count),e.bindVertexArray(null),e.disable(e.BLEND)}dispose(e){A(e,this.prog)}}class ${constructor(){this.name="EarthCinematic",this.programEarth=null,this.programParticles=null,this.programHDR=null,this.vaoEarth=null,this.vaoParticles=null,this.hdrFramebuffer=null,this.hdrTexture=null,this.time=0,this.earthRotation=0,this.particleCount=5e3,this.gl=null,this.particlePositions=new Float32Array(this.particleCount*3),this.particleVelocities=new Float32Array(this.particleCount*3)}init(e){this.gl=e,this.initParticles(),this.initShaders(),this.initGeometry(),this.initHDR()}initParticles(){for(let e=0;e<this.particleCount;e++){const r=e*3,t=Math.random()*Math.PI*2,i=Math.acos(Math.random()*2-1),a=3+Math.random()*2;this.particlePositions[r]=a*Math.sin(i)*Math.cos(t),this.particlePositions[r+1]=a*Math.sin(i)*Math.sin(t),this.particlePositions[r+2]=a*Math.cos(i),this.particleVelocities[r]=(Math.random()-.5)*.01,this.particleVelocities[r+1]=(Math.random()-.5)*.01,this.particleVelocities[r+2]=(Math.random()-.5)*.01}}initShaders(){this.gl;const e=`#version 300 es
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
    `,r=`#version 300 es
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
    `,t=`#version 300 es
      precision highp float;
      in vec3 position;
      uniform mat4 uModelView;
      uniform mat4 uProjection;
      
      void main() {
        gl_Position = uProjection * uModelView * vec4(position, 1.0);
        gl_PointSize = 3.0;
      }
    `,i=`#version 300 es
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
    `,a=`#version 300 es
      precision highp float;
      in vec2 position;
      out vec2 vUv;
      
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `,o=`#version 300 es
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
    `;this.programEarth=this.createProgram(e,r),this.programParticles=this.createProgram(t,i),this.programHDR=this.createProgram(a,o)}createProgram(e,r){const t=this.gl,i=t.createShader(t.VERTEX_SHADER);t.shaderSource(i,e),t.compileShader(i);const a=t.createShader(t.FRAGMENT_SHADER);t.shaderSource(a,r),t.compileShader(a);const o=t.createProgram();return t.attachShader(o,i),t.attachShader(o,a),t.linkProgram(o),o}initGeometry(){const e=this.gl,r=this.createSphere(1,32,32);this.vaoEarth=e.createVertexArray(),e.bindVertexArray(this.vaoEarth);const t=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,r.positions,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0);const i=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,r.normals,e.STATIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0);const a=e.createBuffer();e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,a),e.bufferData(e.ELEMENT_ARRAY_BUFFER,r.indices,e.STATIC_DRAW),this.vaoParticles=e.createVertexArray(),e.bindVertexArray(this.vaoParticles);const o=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,this.particlePositions,e.DYNAMIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindVertexArray(null)}createSphere(e,r,t){const i=[],a=[],o=[];for(let n=0;n<=t;n++){const h=n/t*Math.PI;for(let f=0;f<=r;f++){const d=f/r*Math.PI*2,E=-e*Math.cos(d)*Math.sin(h),R=e*Math.cos(h),T=e*Math.sin(d)*Math.sin(h);i.push(E,R,T),a.push(E/e,R/e,T/e)}}for(let n=0;n<t;n++)for(let c=0;c<r;c++){const h=n*(r+1)+c,f=h+r+1;o.push(h,f,h+1,f,f+1,h+1)}return{positions:new Float32Array(i),normals:new Float32Array(a),indices:new Uint16Array(o)}}initHDR(){const e=this.gl,r=e.canvas.width,t=e.canvas.height;this.hdrFramebuffer=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,this.hdrFramebuffer),this.hdrTexture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.hdrTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGB16F,r,t,0,e.RGB,e.FLOAT,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.hdrTexture,0);const i=e.createRenderbuffer();e.bindRenderbuffer(e.RENDERBUFFER,i),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT16,r,t),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,i),e.bindFramebuffer(e.FRAMEBUFFER,null)}draw(e,r,t,i){const a=i;this.gl=e,this.time+=a,this.earthRotation+=a*.2,this.updateParticles(a),e.bindFramebuffer(e.FRAMEBUFFER,this.hdrFramebuffer),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.enable(e.DEPTH_TEST);const o=r.proj,n=r.view;this.programEarth&&(e.useProgram(this.programEarth),e.uniformMatrix4fv(e.getUniformLocation(this.programEarth,"uProjection"),!1,o),e.uniformMatrix4fv(e.getUniformLocation(this.programEarth,"uModelView"),!1,n),e.uniform1f(e.getUniformLocation(this.programEarth,"uTime"),this.time),e.bindVertexArray(this.vaoEarth),e.drawElements(e.TRIANGLES,32*32*6,e.UNSIGNED_SHORT,0)),this.programParticles&&(e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE),e.depthMask(!1),e.useProgram(this.programParticles),e.uniformMatrix4fv(e.getUniformLocation(this.programParticles,"uProjection"),!1,o),e.uniformMatrix4fv(e.getUniformLocation(this.programParticles,"uModelView"),!1,n),e.bindVertexArray(this.vaoParticles),e.bindBuffer(e.ARRAY_BUFFER,e.getParameter(e.ARRAY_BUFFER_BINDING)),e.bufferSubData(e.ARRAY_BUFFER,0,this.particlePositions),e.drawArrays(e.POINTS,0,this.particleCount),e.depthMask(!0),e.disable(e.BLEND)),e.bindFramebuffer(e.FRAMEBUFFER,null),e.clear(e.COLOR_BUFFER_BIT),e.disable(e.DEPTH_TEST),this.programHDR&&(e.useProgram(this.programHDR),e.uniform1i(e.getUniformLocation(this.programHDR,"uHDRTexture"),0),e.uniform1f(e.getUniformLocation(this.programHDR,"uExposure"),1.2),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.hdrTexture),this.drawFullscreenQuad())}updateParticles(e){for(let r=0;r<this.particleCount;r++){const t=r*3;this.particlePositions[t]+=this.particleVelocities[t]*e*60,this.particlePositions[t+1]+=this.particleVelocities[t+1]*e*60,this.particlePositions[t+2]+=this.particleVelocities[t+2]*e*60;const i=-this.particlePositions[t],a=-this.particlePositions[t+1],o=-this.particlePositions[t+2],n=i*i+a*a+o*o,c=Math.sqrt(n);if(c>.1){const h=.5/n;this.particleVelocities[t]+=i/c*h*e,this.particleVelocities[t+1]+=a/c*h*e,this.particleVelocities[t+2]+=o/c*h*e}this.particleVelocities[t]*=.98,this.particleVelocities[t+1]*=.98,this.particleVelocities[t+2]*=.98}}drawFullscreenQuad(){const e=this.gl,r=new Float32Array([-1,-1,1,-1,-1,1,1,1]),t=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,r,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.drawArrays(e.TRIANGLE_STRIP,0,4)}perspective(e,r,t,i){const a=1/Math.tan(e/2),o=1/(t-i);return new Float32Array([a/r,0,0,0,0,a,0,0,0,0,(i+t)*o,-1,0,0,2*i*t*o,0])}lookAt(e,r,t){const i=[e[0]-r[0],e[1]-r[1],e[2]-r[2]],a=Math.sqrt(i[0]*i[0]+i[1]*i[1]+i[2]*i[2]);i[0]/=a,i[1]/=a,i[2]/=a;const o=[t[1]*i[2]-t[2]*i[1],t[2]*i[0]-t[0]*i[2],t[0]*i[1]-t[1]*i[0]],n=Math.sqrt(o[0]*o[0]+o[1]*o[1]+o[2]*o[2]);o[0]/=n,o[1]/=n,o[2]/=n;const c=[i[1]*o[2]-i[2]*o[1],i[2]*o[0]-i[0]*o[2],i[0]*o[1]-i[1]*o[0]];return new Float32Array([o[0],c[0],i[0],0,o[1],c[1],i[1],0,o[2],c[2],i[2],0,-(o[0]*e[0]+o[1]*e[1]+o[2]*e[2]),-(c[0]*e[0]+c[1]*e[1]+c[2]*e[2]),-(i[0]*e[0]+i[1]*e[1]+i[2]*e[2]),1])}rotateY(e,r){const t=Math.cos(r),i=Math.sin(r),a=e[0],o=e[1],n=e[2],c=e[3],h=e[8],f=e[9],l=e[10],d=e[11];e[0]=a*t-h*i,e[1]=o*t-f*i,e[2]=n*t-l*i,e[3]=c*t-d*i,e[8]=a*i+h*t,e[9]=o*i+f*t,e[10]=n*i+l*t,e[11]=c*i+d*t}resize(e){this.gl=e;const r=e.canvas.width,t=e.canvas.height;this.hdrTexture&&(e.bindTexture(e.TEXTURE_2D,this.hdrTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGB16F,r,t,0,e.RGB,e.FLOAT,null))}dispose(e){this.gl=e,this.programEarth&&e.deleteProgram(this.programEarth),this.programParticles&&e.deleteProgram(this.programParticles),this.programHDR&&e.deleteProgram(this.programHDR),this.vaoEarth&&e.deleteVertexArray(this.vaoEarth),this.vaoParticles&&e.deleteVertexArray(this.vaoParticles),this.hdrFramebuffer&&e.deleteFramebuffer(this.hdrFramebuffer),this.hdrTexture&&e.deleteTexture(this.hdrTexture)}}const q=`#version 300 es
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
`;class Q{constructor(){this.name="QuantumWavefield"}init(e){this.prog=b(e,u(e,e.VERTEX_SHADER,q),u(e,e.FRAGMENT_SHADER,K)),this.uTime=e.getUniformLocation(this.prog,"uTime"),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),this.vbo=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null)}draw(e,r,t){e.useProgram(this.prog),e.uniform1f(this.uTime,t),e.bindVertexArray(this.vao),e.drawArrays(e.TRIANGLES,0,3),e.bindVertexArray(null)}dispose(e){A(e,this.prog),F(e,this.vao),v(e,this.vbo)}}const Z=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
uniform mat4 uProj, uView;
out vec3 vPos;
void main(){
  vec4 mv = uView * vec4(a_pos,1.0);
  gl_Position = uProj * mv;
  vPos = a_pos;
}
`,J=`#version 300 es
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
`;class ee{constructor(){this.name="VolumetricSpines",this.count=0}init(e){this.prog=b(e,u(e,e.VERTEX_SHADER,Z),u(e,e.FRAGMENT_SHADER,J)),this.uProj=e.getUniformLocation(this.prog,"uProj"),this.uView=e.getUniformLocation(this.prog,"uView");const r=64,t=128,i=new Float32Array(r*t*3);let a=0;for(let o=0;o<r;o++){let n=(Math.random()-.5)*120,c=(Math.random()-.5)*60,h=(Math.random()-.5)*120,f=0,l=0,d=0;for(let E=0;E<t;E++){const R=E/t,T=Math.sin(R*9+o*.3)*.8,w=Math.cos(R*7+o)*.6,_=Math.sin(R*5+o*.7)*.7;f=f*.92+T,l=l*.92+w,d=d*.92+_,n+=f,c+=l,h+=d,i[a++]=n,i[a++]=c,i[a++]=h}}this.count=r*t,this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),this.buffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.buffer),e.bufferData(e.ARRAY_BUFFER,i,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindVertexArray(null)}draw(e,r){e.enable(e.BLEND),e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE_MINUS_SRC_ALPHA),e.useProgram(this.prog),e.uniformMatrix4fv(this.uProj,!1,r.proj),e.uniformMatrix4fv(this.uView,!1,r.view),e.bindVertexArray(this.vao),e.drawArrays(e.LINE_STRIP,0,this.count),e.bindVertexArray(null),e.disable(e.BLEND)}dispose(e){A(e,this.prog),F(e,this.vao),v(e,this.buffer)}}class te{constructor(e){this.running=!1,this.animationFrame=null,this.lastTime=0,this.time=0,this.loop=r=>{if(!this.running)return;const t=(r-this.lastTime)/1e3;this.lastTime=r;const i=Math.min(t,1/15);this.time+=i,this.camera.update(i),this.tfSim.update(this.time,i);const a=this.gl;this.pipeline.bindHDR(),a.clearColor(.043,.055,.063,1),a.clear(a.COLOR_BUFFER_BIT|a.DEPTH_BUFFER_BIT),this.scenes.draw(this.camera,this.time,i),this.pipeline.resolve(1.15),this.animationFrame=requestAnimationFrame(this.loop)},this.resize=()=>{if(!this.gl)return;const r=Math.min(window.devicePixelRatio||1,1.75),t=this.canvas.clientWidth*r,i=this.canvas.clientHeight*r;!t||!i||(this.canvas.width=Math.floor(t),this.canvas.height=Math.floor(i),this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.pipeline.resize(this.canvas.width,this.canvas.height),this.camera.setViewport(this.canvas.width,this.canvas.height),this.scenes.resize())},this.handleResize=()=>{this.resize()},this.canvas=e}start(){const e=this.canvas.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"high-performance"});if(!e)throw new Error("WebGL2 not supported");this.gl=e,e.enable(e.DEPTH_TEST),e.depthFunc(e.LEQUAL),e.disable(e.CULL_FACE),this.pipeline=new C(e),this.camera=new V,this.tfSim=new I(e),this.scenes=new z(e),this.scenes.register(new Y),this.scenes.register(new Q),this.scenes.register(new ee),this.scenes.register(new W(this.tfSim)),this.scenes.register(new $),this.resize(),window.addEventListener("resize",this.handleResize),this.running=!0,this.lastTime=performance.now(),this.time=0,this.setScene("NeuralConstellation"),this.animationFrame=requestAnimationFrame(this.loop)}setScene(e){this.scenes&&this.scenes.use(e)}dispose(){var e,r,t;this.running=!1,this.animationFrame!==null&&cancelAnimationFrame(this.animationFrame),window.removeEventListener("resize",this.handleResize),(e=this.scenes)==null||e.disposeAll(),(r=this.tfSim)==null||r.dispose(),(t=this.pipeline)==null||t.dispose()}}const re=["NeuralConstellation","QuantumWavefield","VolumetricSpines","ParticleVortex","EarthCinematic"];function se(){const s=p.useRef(null),e=p.useRef(null),r=p.useRef(null),[t,i]=p.useState("NeuralConstellation"),[a,o]=p.useState(null);p.useEffect(()=>{const c=e.current;if(c)try{const h=new te(c);r.current=h,h.start(),h.setScene(t);const f=()=>h.resize();f();const l=typeof ResizeObserver<"u"?new ResizeObserver(f):null;return l&&s.current?l.observe(s.current):window.addEventListener("resize",f),()=>{l?l.disconnect():window.removeEventListener("resize",f),h.dispose(),r.current=null}}catch(h){o((h==null?void 0:h.message)||"Unable to start cinematic engine")}},[]),p.useEffect(()=>{var c;(c=r.current)==null||c.setScene(t)},[t]);const n=p.useMemo(()=>re.map(c=>m.jsx("button",{onClick:()=>i(c),className:`px-3 py-1.5 text-xs uppercase tracking-[0.2em] rounded transition-colors border ${t===c?"border-white/70 bg-white/10 text-white":"border-white/10 bg-black/30 text-white/70 hover:text-white hover:border-white/40"}`,type:"button",children:c.replace(/([a-z])([A-Z])/g,"$1 $2")},c)),[t]);return m.jsxs("div",{ref:s,className:"relative h-full w-full overflow-hidden bg-black",children:[m.jsx("canvas",{ref:e,className:"h-full w-full"}),m.jsx("div",{className:"pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"}),m.jsx("div",{className:"pointer-events-auto absolute top-4 left-4 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur",children:n}),m.jsxs("div",{className:"pointer-events-none absolute bottom-4 left-4 max-w-sm rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/80 backdrop-blur",children:[m.jsx("p",{className:"font-semibold uppercase tracking-[0.3em] text-white/70",children:"Cinematic Neural Atlas"}),m.jsx("p",{className:"mt-2 leading-relaxed text-white/70",children:"Explore four shader-driven narratives rendered in HDR: constellations of thought, quantum interference, volumetric spines, and a transform-feedback particle vortex."})]}),a&&m.jsx("div",{className:"pointer-events-auto absolute bottom-4 right-4 max-w-xs rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs text-red-200",children:a})]})}export{se as default};
