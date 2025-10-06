import React, { useEffect, useRef, useState } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Color3,
  Color4,
  PointLight,
  GlowLayer,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  CubeTexture,
  Animation
} from '@babylonjs/core';
import { applyGraphScene, disposeGraphScene } from './babylonGraphScene';
import type { GraphNode, GraphEdge } from './babylonGraphScene';

interface BabylonWebGLRendererProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export const BabylonWebGLRenderer: React.FC<BabylonWebGLRendererProps> = ({
  nodes,
  edges,
  onNodeClick,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  const handleResizeRef = useRef<(() => void) | null>(null);
  const handlePointerDownRef = useRef<((evt: any, pickResult: any) => void) | null>(null);

  useEffect(() => {
    const initWebGL = async () => {
      if (!canvasRef.current) return;

      try {
        console.log('🚀 Initializing WebGL Babylon renderer (mid-tier)...');

        const engine = new Engine(
          canvasRef.current,
          true,
          {
            useHighPrecisionMatrix: true,
            antialias: true,
            powerPreference: 'high-performance',
            doNotHandleContextLost: false,
          }
        );

        engineRef.current = engine;

        const scene = new Scene(engine);
        sceneRef.current = scene;

        scene.clearColor = new Color4(0, 0, 0, 1);
        
        const hdrTexture = CubeTexture.CreateFromPrefilteredData(
          'https://playground.babylonjs.com/textures/SpecularHDR.dds',
          scene
        );
        scene.environmentTexture = hdrTexture;
        scene.environmentIntensity = 1.2;

        const camera = new ArcRotateCamera(
          'camera',
          -Math.PI / 2,
          Math.PI / 2.5,
          1200,
          Vector3.Zero(),
          scene
        );
        camera.attachControl(canvasRef.current, true);
        
        camera.lowerRadiusLimit = 200;
        camera.upperRadiusLimit = 8000;
        camera.minZ = 0.1;
        camera.maxZ = 20000;
        
        camera.lowerBetaLimit = null;
        camera.upperBetaLimit = null;
        camera.allowUpsideDown = true;
        
        camera.wheelPrecision = 3;
        camera.pinchPrecision = 3;
        camera.panningSensibility = 1000;
        camera.inertia = 0.85;
        camera.angularSensibilityX = 500;
        camera.angularSensibilityY = 500;
        
        camera.useAutoRotationBehavior = false;
        camera.checkCollisions = false;

        const resetCamera = () => {
          camera.setTarget(Vector3.Zero());
          Animation.CreateAndStartAnimation(
            'cameraResetRadius',
            camera,
            'radius',
            60,
            30,
            camera.radius,
            1200,
            0
          );
          Animation.CreateAndStartAnimation(
            'cameraResetAlpha',
            camera,
            'alpha',
            60,
            30,
            camera.alpha,
            Math.PI / 4,
            0
          );
          Animation.CreateAndStartAnimation(
            'cameraResetBeta',
            camera,
            'beta',
            60,
            30,
            camera.beta,
            Math.PI / 3,
            0
          );
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            resetCamera();
          }
        };
        handleKeyDownRef.current = handleKeyDown;

        const handlePointerDown = (evt: any, pickResult: any) => {
          if (!pickResult.hit && evt.button === 0 && evt.detail === 2) {
            resetCamera();
          }
        };
        handlePointerDownRef.current = handlePointerDown;

        window.addEventListener('keydown', handleKeyDown);
        scene.onPointerDown = handlePointerDown;

        const ambientLight = new HemisphericLight(
          'ambient',
          new Vector3(0, 1, 0),
          scene
        );
        ambientLight.intensity = 0.2;
        ambientLight.diffuse = new Color3(0.1, 0.15, 0.2);
        ambientLight.groundColor = new Color3(0, 0, 0);

        const keyLight = new PointLight(
          'keyLight',
          new Vector3(500, 800, -500),
          scene
        );
        keyLight.intensity = 2.5;
        keyLight.diffuse = new Color3(0, 1, 1);
        keyLight.specular = new Color3(1, 1, 1);
        keyLight.range = 5000;

        const fillLight = new PointLight(
          'fillLight',
          new Vector3(-500, 500, 500),
          scene
        );
        fillLight.intensity = 1.8;
        fillLight.diffuse = new Color3(1, 0.3, 1);
        fillLight.specular = new Color3(0.5, 0.5, 0.5);
        fillLight.range = 5000;

        const glowLayer = new GlowLayer('glow', scene, {
          mainTextureFixedSize: 2048,
          blurKernelSize: 128
        });
        glowLayer.intensity = 3.5;

        const defaultPipeline = new DefaultRenderingPipeline(
          'default',
          false,
          scene,
          [camera]
        );
        defaultPipeline.samples = 4;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.bloomThreshold = 0.2;
        defaultPipeline.bloomWeight = 1.5;
        defaultPipeline.bloomKernel = 128;
        defaultPipeline.bloomScale = 0.8;

        defaultPipeline.imageProcessingEnabled = true;
        if (defaultPipeline.imageProcessing) {
          defaultPipeline.imageProcessing.toneMappingEnabled = true;
          defaultPipeline.imageProcessing.toneMappingType = 1;
          defaultPipeline.imageProcessing.exposure = 1.3;
          defaultPipeline.imageProcessing.contrast = 1.15;
          defaultPipeline.imageProcessing.vignetteEnabled = true;
          defaultPipeline.imageProcessing.vignetteWeight = 0.8;
        }

        const ssao = new SSAO2RenderingPipeline(
          'ssao',
          scene,
          {
            ssaoRatio: 0.5,
            blurRatio: 0.5
          },
          [camera]
        );
        ssao.radius = 1.8;
        ssao.totalStrength = 0.7;
        ssao.base = 0.4;

        applyGraphScene(scene, nodes, edges, onNodeClick);

        engine.runRenderLoop(() => {
          scene.render();
        });

        const handleResize = () => {
          engine.resize();
        };
        handleResizeRef.current = handleResize;
        
        window.addEventListener('resize', handleResize);

        setIsReady(true);
        console.log('✅ WebGL Babylon renderer initialized successfully');

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('❌ WebGL initialization failed:', errorMsg);
        setError(errorMsg);
      }
    };

    initWebGL();

    return () => {
      if (handleKeyDownRef.current) {
        window.removeEventListener('keydown', handleKeyDownRef.current);
        handleKeyDownRef.current = null;
      }
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current);
        handleResizeRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.onPointerDown = undefined;
        handlePointerDownRef.current = null;
        disposeGraphScene(sceneRef.current, { disposeBackground: true });
        sceneRef.current.dispose();
      }
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current && isReady) {
      applyGraphScene(sceneRef.current, nodes, edges, onNodeClick);
    }
  }, [nodes, edges, isReady, onNodeClick]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'pan-y' }}
      />
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="text-cyan-400 text-xl mb-2">Initializing WebGL...</div>
            <div className="text-cyan-400/60 text-sm">High-quality renderer</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="text-red-400 text-xl mb-2">WebGL Failed</div>
            <div className="text-red-400/60 text-sm">{error}</div>
          </div>
        </div>
      )}
      {isReady && (
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-cyan-500/40 shadow-lg">
          <div className="text-cyan-400 text-xs font-mono whitespace-nowrap">
            WebGL | {nodes.length}N | {edges.length}E
          </div>
        </div>
      )}
    </div>
  );
};
