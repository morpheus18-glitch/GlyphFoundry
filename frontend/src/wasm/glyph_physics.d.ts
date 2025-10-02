/* tslint:disable */
/* eslint-disable */
export function main(): void;
export class PhysicsEngine {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  setNodes(nodes_js: any): void;
  setEdges(edges_js: any): void;
  setParams(repulsion: number, attraction: number, damping: number, theta: number): void;
  tick(delta_time: number): any;
  getNodes(): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_physicsengine_free: (a: number, b: number) => void;
  readonly physicsengine_new: () => number;
  readonly physicsengine_setNodes: (a: number, b: any) => [number, number];
  readonly physicsengine_setEdges: (a: number, b: any) => [number, number];
  readonly physicsengine_setParams: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly physicsengine_tick: (a: number, b: number) => [number, number, number];
  readonly physicsengine_getNodes: (a: number) => [number, number, number];
  readonly main: () => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
