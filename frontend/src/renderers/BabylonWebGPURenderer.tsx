import React, { useEffect, useRef, useState } from 'react';
import {
  Engine,
  WebGPUEngine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  ShadowGenerator,
  GlowLayer,
  DefaultRenderingPipeline,
  SSAORenderingPipeline,
  SSAO2RenderingPipeline,
  MotionBlurPostProcess,
  VolumetricLightScatteringPostProcess,
  Mesh,
  ActionManager,
  ExecuteCodeAction
} from '@babylonjs/core';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  size?: number;
  color?: string;
  label?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
}

interface BabylonWebGPURendererProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export const BabylonWebGPURenderer: React.FC<BabylonWebGPURendererProps> = ({
  nodes,
  edges,
  onNodeClick,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | WebGPUEngine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initWebGPU = async () => {
      if (!canvasRef.current) return;

      try {
        console.log('🚀 Initializing WebGPU Babylon renderer...');

        // Check WebGPU support
        const webGPUSupported = await WebGPUEngine.IsSupportedAsync;

        let engine: Engine | WebGPUEngine;
        
        if (webGPUSupported) {
          console.log('✅ WebGPU supported, using WebGPU engine');
          const webGPUEngine = new WebGPUEngine(canvasRef.current, {
            antialias: true,
            powerPreference: 'high-performance',
          });
          await webGPUEngine.initAsync();
          engine = webGPUEngine;
        } else {
          console.log('⚠️ WebGPU not supported, falling back to WebGL');
          engine = new Engine(
            canvasRef.current,
            true,
            {
              useHighPrecisionMatrix: true,
              antialias: true,
              powerPreference: 'high-performance',
              doNotHandleContextLost: false,
            }
          );
        }

        engineRef.current = engine;

        const scene = new Scene(engine);
        sceneRef.current = scene;

        scene.clearColor = new Color4(0, 0, 0, 1);

        const camera = new ArcRotateCamera(
          'camera',
          -Math.PI / 2,
          Math.PI / 2.5,
          500,
          Vector3.Zero(),
          scene
        );
        camera.attachControl(canvasRef.current, true);
        camera.lowerRadiusLimit = 50;
        camera.upperRadiusLimit = 2000;
        camera.wheelPrecision = 50;
        camera.pinchPrecision = 50;

        const ambientLight = new HemisphericLight(
          'ambient',
          new Vector3(0, 1, 0),
          scene
        );
        ambientLight.intensity = 0.3;

        const keyLight = new PointLight(
          'keyLight',
          new Vector3(200, 300, -200),
          scene
        );
        keyLight.intensity = 0.8;
        keyLight.diffuse = new Color3(0, 1, 1);

        const fillLight = new PointLight(
          'fillLight',
          new Vector3(-200, 200, 200),
          scene
        );
        fillLight.intensity = 0.5;
        fillLight.diffuse = new Color3(1, 0, 1);

        const glowLayer = new GlowLayer('glow', scene, {
          mainTextureFixedSize: 1024,
          blurKernelSize: 64
        });
        glowLayer.intensity = 2.0;

        const defaultPipeline = new DefaultRenderingPipeline(
          'default',
          true,
          scene,
          [camera]
        );
        defaultPipeline.samples = 4;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.bloomThreshold = 0.3;
        defaultPipeline.bloomWeight = 0.8;
        defaultPipeline.bloomKernel = 64;
        defaultPipeline.bloomScale = 0.5;

        defaultPipeline.chromaticAberrationEnabled = true;
        if (defaultPipeline.chromaticAberration) {
          defaultPipeline.chromaticAberration.aberrationAmount = 30;
        }

        defaultPipeline.imageProcessingEnabled = true;
        if (defaultPipeline.imageProcessing) {
          defaultPipeline.imageProcessing.toneMappingEnabled = true;
          defaultPipeline.imageProcessing.toneMappingType = 1;
          defaultPipeline.imageProcessing.exposure = 1.4;
          defaultPipeline.imageProcessing.contrast = 1.3;
          defaultPipeline.imageProcessing.vignetteEnabled = true;
          defaultPipeline.imageProcessing.vignetteWeight = 1.5;
        }

        const ssao = new SSAO2RenderingPipeline(
          'ssao',
          scene,
          {
            ssaoRatio: 0.5,
            blurRatio: 1
          },
          [camera]
        );
        ssao.radius = 3;
        ssao.totalStrength = 1.5;
        ssao.base = 0.1;

        renderGraph(scene, nodes, edges, onNodeClick);

        engine.runRenderLoop(() => {
          scene.render();
        });

        window.addEventListener('resize', () => {
          engine.resize();
        });

        setIsReady(true);
        console.log('✅ WebGPU Babylon renderer initialized successfully');

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('❌ WebGPU initialization failed:', errorMsg);
        setError(errorMsg);
      }
    };

    initWebGPU();

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current && isReady) {
      sceneRef.current.meshes.forEach((mesh) => {
        if (mesh.name.startsWith('node-') || mesh.name.startsWith('edge-')) {
          mesh.dispose();
        }
      });
      
      renderGraph(sceneRef.current, nodes, edges, onNodeClick);
    }
  }, [nodes, edges, isReady, onNodeClick]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      />
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="text-cyan-400 text-xl mb-2">Initializing WebGPU...</div>
            <div className="text-cyan-400/60 text-sm">Game engine-quality renderer</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="text-red-400 text-xl mb-2">WebGPU Failed</div>
            <div className="text-red-400/60 text-sm">{error}</div>
          </div>
        </div>
      )}
      {isReady && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-cyan-500/30">
          <div className="text-cyan-400 text-sm font-mono">
            WebGPU | {nodes.length} nodes | {edges.length} edges
          </div>
        </div>
      )}
    </div>
  );
};

function renderGraph(
  scene: Scene,
  nodes: GraphNode[],
  edges: GraphEdge[],
  onNodeClick?: (nodeId: string) => void
) {
  const nodeMap = new Map<string, Mesh>();

  nodes.forEach((node) => {
    const sphere = MeshBuilder.CreateSphere(
      `node-${node.id}`,
      { diameter: (node.size || 10) * 2, segments: 16 },
      scene
    );

    sphere.position = new Vector3(node.x, node.y, node.z);

    const material = new StandardMaterial(`mat-${node.id}`, scene);
    const color = node.color || '#00ffff';
    const rgb = hexToRgb(color);
    material.emissiveColor = new Color3(rgb.r, rgb.g, rgb.b);
    material.diffuseColor = new Color3(rgb.r * 0.5, rgb.g * 0.5, rgb.b * 0.5);
    material.specularColor = new Color3(1, 1, 1);
    material.specularPower = 64;

    sphere.material = material;

    if (onNodeClick) {
      sphere.actionManager = new ActionManager(scene);
      sphere.actionManager.registerAction(
        new ExecuteCodeAction(
          ActionManager.OnPickTrigger,
          () => onNodeClick(node.id)
        )
      );
    }

    nodeMap.set(node.id, sphere);
  });

  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (sourceNode && targetNode) {
      const line = MeshBuilder.CreateLines(
        `edge-${edge.source}-${edge.target}`,
        {
          points: [sourceNode.position, targetNode.position]
        },
        scene
      );

      const edgeMaterial = new StandardMaterial(`edge-mat-${edge.source}-${edge.target}`, scene);
      edgeMaterial.emissiveColor = new Color3(0, 1, 1);
      edgeMaterial.alpha = 0.3;
      
      line.color = new Color3(0, 1, 1);
      line.alpha = 0.3;
    }
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
      }
    : { r: 0, g: 1, b: 1 };
}
