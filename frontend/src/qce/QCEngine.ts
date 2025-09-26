import { CinematicCamera } from "./engine/core/Camera";
import { HDRPipeline } from "./engine/core/HDRPipeline";
import { TFParticleSim } from "./engine/particles/TFParticleSim";
import { SceneManager } from "./scenes/SceneManager";
import { NeuralConstellation } from "./scenes/NeuralConstellation";
import { ParticleVortex } from "./scenes/ParticleVortex";
import { QuantumWavefield } from "./scenes/QuantumWavefield";
import { VolumetricSpines } from "./scenes/VolumetricSpines";

export class QCEngine {
  private canvas: HTMLCanvasElement;
  private gl!: WebGL2RenderingContext;
  private running = false;
  private animationFrame: number | null = null;
  private lastTime = 0;
  private time = 0;
  private pipeline!: HDRPipeline;
  private camera!: CinematicCamera;
  private tfSim!: TFParticleSim;
  private scenes!: SceneManager;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  start() {
    const gl = this.canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    this.pipeline = new HDRPipeline(gl);
    this.camera = new CinematicCamera();
    this.tfSim = new TFParticleSim(gl);
    this.scenes = new SceneManager(gl);
    this.scenes.register(new NeuralConstellation());
    this.scenes.register(new QuantumWavefield());
    this.scenes.register(new VolumetricSpines());
    this.scenes.register(new ParticleVortex(this.tfSim));

    this.resize();
    window.addEventListener("resize", this.handleResize);

    this.running = true;
    this.lastTime = performance.now();
    this.time = 0;
    this.setScene("NeuralConstellation");
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    if (!this.running) return;
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const clampedDt = Math.min(dt, 1 / 15);
    this.time += clampedDt;

    this.camera.update(clampedDt);
    this.tfSim.update(this.time, clampedDt);

    const gl = this.gl;
    this.pipeline.bindHDR();
    gl.clearColor(0.043, 0.055, 0.063, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.scenes.draw(this.camera, this.time, clampedDt);

    this.pipeline.resolve(1.15);

    this.animationFrame = requestAnimationFrame(this.loop);
  };

  setScene(name: string) {
    if (!this.scenes) return;
    this.scenes.use(name);
  }

  resize = () => {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = this.canvas.clientWidth * dpr;
    const height = this.canvas.clientHeight * dpr;
    if (!width || !height) return;
    this.canvas.width = Math.floor(width);
    this.canvas.height = Math.floor(height);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.pipeline.resize(this.canvas.width, this.canvas.height);
    this.camera.setViewport(this.canvas.width, this.canvas.height);
    this.scenes.resize();
  };

  private handleResize = () => {
    this.resize();
  };

  dispose() {
    this.running = false;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.handleResize);
    this.scenes?.disposeAll();
    this.tfSim?.dispose();
    this.pipeline?.dispose();
  }
}
