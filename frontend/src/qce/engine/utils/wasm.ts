type KernelsModule = typeof import('@qce-wasm/qce_kernels_wasm.js');

let wasmModule: KernelsModule | null = null;

async function importModule(): Promise<KernelsModule> {
  try {
    const module = (await import('@qce-wasm/qce_kernels_wasm.js')) as KernelsModule;
    await module.default();
    return module;
  } catch (error) {
    console.error('Failed to load qce_kernels WebAssembly module.', error);
    throw new Error(
      'Unable to load qce_kernels_wasm. Ensure wasm-pack build --release --target web has been run.'
    );
  }
}

export async function loadWasm(): Promise<void> {
  if (wasmModule) {
    return;
  }
  wasmModule = await importModule();
}

function ensureModule(): KernelsModule {
  if (!wasmModule) {
    throw new Error('qce_kernels_wasm has not been initialised. Call loadWasm() first.');
  }
  return wasmModule;
}

export function taaReproject(
  curr: Float32Array,
  prev: Float32Array,
  motion: Float32Array,
  w: number,
  h: number,
  blend: number
): Float32Array {
  const module = ensureModule();
  return module.taa_reproject_wasm(curr, prev, motion, w, h, blend);
}

export function ssrStep(hitDepth: number, roughness: number, stepCount: number): [number, number] {
  const module = ensureModule();
  const arr = Array.from(module.ssr_step_wasm(hitDepth, roughness, stepCount) as unknown as number[]);
  if (arr.length !== 2) {
    throw new Error('ssr_step_wasm returned an unexpected payload.');
  }
  return [Number(arr[0]), Number(arr[1])];
}

export function interference(u: number, v: number, t: number): number {
  const module = ensureModule();
  return module.interference_wasm(u, v, t);
}
