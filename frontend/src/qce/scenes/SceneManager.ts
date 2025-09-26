import type { Scene } from "./SceneTypes";

export class SceneManager {
  private gl: WebGL2RenderingContext;
  private scenes: Record<string, Scene> = {};
  private current?: Scene;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  register(scene: Scene) {
    this.scenes[scene.name] = scene;
  }

  use(name: string) {
    if (this.current?.name === name) return;
    const next = this.scenes[name];
    if (!next) throw new Error(`Scene not found: ${name}`);
    if (this.current?.dispose) this.current.dispose(this.gl);
    next.init(this.gl);
    this.current = next;
  }

  resize() {
    this.current?.resize?.(this.gl);
  }

  draw(camera: { proj: Float32Array; view: Float32Array }, t: number, dt: number) {
    if (!this.current) return;
    this.current.draw(this.gl, camera, t, dt);
  }

  disposeAll() {
    Object.values(this.scenes).forEach((scene) => {
      scene.dispose?.(this.gl);
    });
  }
}
