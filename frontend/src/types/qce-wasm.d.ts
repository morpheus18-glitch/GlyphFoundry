declare module '@qce-wasm/qce_kernels_wasm.js' {
  export default function init(input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<void>;
  export function taa_reproject_wasm(
    curr: Float32Array,
    prev: Float32Array,
    motion: Float32Array,
    w: number,
    h: number,
    blend: number
  ): Float32Array;
  export function ssr_step_wasm(hitDepth: number, roughness: number, stepCount: number): number[];
  export function interference_wasm(u: number, v: number, t: number): number;
}
