export interface Scene {
  name: string;
  init(gl: WebGL2RenderingContext): void;
  resize?(gl: WebGL2RenderingContext): void;
  draw(
    gl: WebGL2RenderingContext,
    camera: { proj: Float32Array; view: Float32Array },
    t: number,
    dt: number
  ): void;
  dispose?(gl: WebGL2RenderingContext): void;
}
