import React, { useEffect, useMemo, useRef, useState } from "react";
import { QCEngine } from "../qce/QCEngine";

const SCENE_NAMES = [
  "NeuralConstellation",
  "QuantumWavefield",
  "VolumetricSpines",
  "ParticleVortex",
] as const;

type SceneName = (typeof SCENE_NAMES)[number];

export default function CinematicScenes() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<QCEngine | null>(null);
  const [active, setActive] = useState<SceneName>("NeuralConstellation");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const engine = new QCEngine(canvas);
      engineRef.current = engine;
      engine.start();
      engine.setScene(active);
      const handle = () => engine.resize();
      handle();
      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handle) : null;
      if (observer && containerRef.current) {
        observer.observe(containerRef.current);
      } else {
        window.addEventListener("resize", handle);
      }
      return () => {
        if (observer) {
          observer.disconnect();
        } else {
          window.removeEventListener("resize", handle);
        }
        engine.dispose();
        engineRef.current = null;
      };
    } catch (e: any) {
      setError(e?.message || "Unable to start cinematic engine");
    }
  }, []);

  useEffect(() => {
    engineRef.current?.setScene(active);
  }, [active]);

  const buttons = useMemo(
    () =>
      SCENE_NAMES.map((name) => (
        <button
          key={name}
          onClick={() => setActive(name)}
          className={`px-3 py-1.5 text-xs uppercase tracking-[0.2em] rounded transition-colors border ${
            active === name
              ? "border-white/70 bg-white/10 text-white"
              : "border-white/10 bg-black/30 text-white/70 hover:text-white hover:border-white/40"
          }`}
          type="button"
        >
          {name.replace(/([a-z])([A-Z])/g, "$1 $2")}
        </button>
      )),
    [active]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      <div className="pointer-events-auto absolute top-4 left-4 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur">
        {buttons}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 max-w-sm rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/80 backdrop-blur">
        <p className="font-semibold uppercase tracking-[0.3em] text-white/70">Cinematic Neural Atlas</p>
        <p className="mt-2 leading-relaxed text-white/70">
          Explore four shader-driven narratives rendered in HDR: constellations of thought, quantum
          interference, volumetric spines, and a transform-feedback particle vortex.
        </p>
      </div>
      {error && (
        <div className="pointer-events-auto absolute bottom-4 right-4 max-w-xs rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
