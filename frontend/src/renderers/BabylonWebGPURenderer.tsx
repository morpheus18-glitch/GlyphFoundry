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
  PBRMaterial,
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
  ExecuteCodeAction,
  Texture,
  Animation,
  CubeTexture
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
        
        const hdrTexture = CubeTexture.CreateFromPrefilteredData(
          'https://playground.babylonjs.com/textures/SpecularHDR.dds',
          scene
        );
        scene.environmentTexture = hdrTexture;
        scene.environmentIntensity = 0.8;

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
        
        camera.wheelPrecision = 50;
        camera.pinchPrecision = 50;
        camera.panningSensibility = 1000;
        camera.inertia = 0.85;
        camera.angularSensibilityX = 500;
        camera.angularSensibilityY = 500;
        
        camera.useAutoRotationBehavior = false;
        camera.checkCollisions = false;

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
          blurKernelSize: 96
        });
        glowLayer.intensity = 1.4;

        const defaultPipeline = new DefaultRenderingPipeline(
          'default',
          true,
          scene,
          [camera]
        );
        defaultPipeline.samples = 4;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.bloomThreshold = 0.4;
        defaultPipeline.bloomWeight = 0.7;
        defaultPipeline.bloomKernel = 96;
        defaultPipeline.bloomScale = 0.6;

        defaultPipeline.chromaticAberrationEnabled = true;
        if (defaultPipeline.chromaticAberration) {
          defaultPipeline.chromaticAberration.aberrationAmount = 50;
        }

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
            blurRatio: 1
          },
          [camera]
        );
        ssao.radius = 1.8;
        ssao.totalStrength = 0.7;
        ssao.base = 0.4;

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
        style={{ touchAction: 'pan-y' }}
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
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-cyan-500/40 shadow-lg">
          <div className="text-cyan-400 text-xs font-mono whitespace-nowrap">
            WebGPU | {nodes.length}N | {edges.length}E
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

  nodes.forEach((node, index) => {
    const baseDiameter = (node.size || 10) * 6;
    const sphere = MeshBuilder.CreateIcoSphere(
      `node-${node.id}`,
      { 
        radius: baseDiameter,
        subdivisions: 4,
        flat: true
      },
      scene
    );

    sphere.position = new Vector3(node.x, node.y, node.z);

    const material = new PBRMaterial(`mat-${node.id}`, scene);
    const color = node.color || '#00ffff';
    const rgb = hexToRgb(color);
    
    material.albedoColor = new Color3(rgb.r, rgb.g, rgb.b);
    material.emissiveColor = new Color3(rgb.r * 4, rgb.g * 4, rgb.b * 4);
    material.emissiveIntensity = 1.8;
    
    material.metallic = 0.9;
    material.roughness = 0.2;
    
    const normalMap = new Texture("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight/grasslight-big-nm.jpg", scene);
    material.bumpTexture = normalMap;
    material.bumpTexture.level = 1.2;
    
    material.directIntensity = 1.5;
    material.environmentIntensity = 0.8;
    material.specularIntensity = 1.2;
    
    material.alpha = 0.98;
    material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;

    sphere.material = material;

    scene.registerBeforeRender(() => {
      const time = performance.now() * 0.001;
      const phaseOffset = (index % 10) * 0.5;
      sphere.scaling.setAll(1 + Math.sin(time * 2 + phaseOffset) * 0.15);
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
              const distance = Math.max(baseDiameter * 8, 300);
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
