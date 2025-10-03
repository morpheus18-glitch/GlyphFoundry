import React, { useEffect, useRef, useState } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  GlowLayer,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  Texture,
  Animation
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
        glowLayer.intensity = 3.0;

        const defaultPipeline = new DefaultRenderingPipeline(
          'default',
          false,
          scene,
          [camera]
        );
        defaultPipeline.samples = 2;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.bloomThreshold = 0.1;
        defaultPipeline.bloomWeight = 1.3;
        defaultPipeline.bloomKernel = 64;
        defaultPipeline.bloomScale = 0.7;

        defaultPipeline.imageProcessingEnabled = true;
        if (defaultPipeline.imageProcessing) {
          defaultPipeline.imageProcessing.toneMappingEnabled = true;
          defaultPipeline.imageProcessing.toneMappingType = 1;
          defaultPipeline.imageProcessing.exposure = 2.0;
          defaultPipeline.imageProcessing.contrast = 1.4;
          defaultPipeline.imageProcessing.vignetteEnabled = true;
          defaultPipeline.imageProcessing.vignetteWeight = 1.8;
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
        ssao.radius = 2;
        ssao.totalStrength = 1.0;
        ssao.base = 0.2;

        renderGraph(scene, nodes, edges, onNodeClick);

        engine.runRenderLoop(() => {
          scene.render();
        });

        window.addEventListener('resize', () => {
          engine.resize();
        });

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
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-cyan-500/30">
          <div className="text-cyan-400 text-sm font-mono">
            WebGL | {nodes.length} nodes | {edges.length} edges
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
    const baseDiameter = (node.size || 10) * 6;
    const sphere = MeshBuilder.CreateIcoSphere(
      `node-${node.id}`,
      { 
        radius: baseDiameter,
        subdivisions: 3,
        flat: false
      },
      scene
    );

    sphere.position = new Vector3(node.x, node.y, node.z);

    const material = new StandardMaterial(`mat-${node.id}`, scene);
    const color = node.color || '#00ffff';
    const rgb = hexToRgb(color);
    material.emissiveColor = new Color3(rgb.r * 7.0, rgb.g * 7.0, rgb.b * 7.0);
    material.diffuseColor = new Color3(rgb.r * 0.4, rgb.g * 0.4, rgb.b * 0.4);
    material.specularColor = new Color3(3, 3, 3);
    material.specularPower = 256;
    material.alpha = 0.9;
    material.bumpTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", scene);

    sphere.material = material;

    scene.registerBeforeRender(() => {
      const time = performance.now() * 0.001;
      sphere.scaling.setAll(1 + Math.sin(time * 2 + parseInt(node.id) * 0.5) * 0.15);
      sphere.rotation.y += 0.005;
    });

    if (onNodeClick) {
      sphere.actionManager = new ActionManager(scene);
      sphere.actionManager.registerAction(
        new ExecuteCodeAction(
          ActionManager.OnPickTrigger,
          () => {
            const camera = scene.activeCamera as ArcRotateCamera;
            if (camera) {
              camera.setTarget(sphere.position);
              const distance = baseDiameter * 3;
              Animation.CreateAndStartAnimation(
                'cameraZoom',
                camera,
                'radius',
                60,
                30,
                camera.radius,
                distance,
                0
              );
            }
            onNodeClick(node.id);
          }
        )
      );
    }

    nodeMap.set(node.id, sphere);
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
