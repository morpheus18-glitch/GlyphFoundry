import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

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

interface ThreeJSFallbackRendererProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export const ThreeJSFallbackRenderer: React.FC<ThreeJSFallbackRendererProps> = ({
  nodes,
  edges,
  onNodeClick,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nodeObjectsRef = useRef<Map<string, THREE.Mesh>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      console.log('🚀 Initializing Three.js fallback renderer...');

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        10000
      );
      camera.position.set(0, 300, 500);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 50;
      controls.maxDistance = 2000;
      controlsRef.current = controls;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0x00ffff, 1, 1000);
      pointLight1.position.set(200, 300, -200);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xff00ff, 0.8, 1000);
      pointLight2.position.set(-200, 200, 200);
      scene.add(pointLight2);

      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.0,
        0.4,
        0.85
      );
      composer.addPass(bloomPass);
      composerRef.current = composer;

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const handleClick = (event: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(Array.from(nodeObjectsRef.current.values()));

        if (intersects.length > 0 && onNodeClick) {
          const nodeId = intersects[0].object.userData.nodeId;
          if (nodeId) {
            onNodeClick(nodeId);
          }
        }
      };

      renderer.domElement.addEventListener('click', handleClick);

      const handleResize = () => {
        if (!containerRef.current || !camera || !renderer || !composer) return;
        
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);

      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        composer.render();
      };
      animate();

      setIsReady(true);
      console.log('✅ Three.js fallback renderer initialized');

      return () => {
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('click', handleClick);
        controls.dispose();
        renderer.dispose();
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Three.js initialization failed:', errorMsg);
      setError(errorMsg);
    }
  }, [onNodeClick]);

  useEffect(() => {
    if (!sceneRef.current || !isReady) return;

    nodeObjectsRef.current.forEach(obj => sceneRef.current?.remove(obj));
    nodeObjectsRef.current.clear();

    const nodeMap = new Map<string, THREE.Mesh>();

    nodes.forEach(node => {
      const geometry = new THREE.SphereGeometry((node.size || 10) / 2, 16, 16);
      const color = node.color || '#00ffff';
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.5,
        roughness: 0.3,
        metalness: 0.7
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(node.x, node.y, node.z);
      mesh.userData.nodeId = node.id;

      sceneRef.current!.add(mesh);
      nodeMap.set(node.id, mesh);
      nodeObjectsRef.current.set(node.id, mesh);
    });

    edges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (sourceNode && targetNode) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          sourceNode.position,
          targetNode.position
        ]);
        const material = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          opacity: 0.3,
          transparent: true
        });
        const line = new THREE.Line(geometry, material);
        sceneRef.current!.add(line);
      }
    });
  }, [nodes, edges, isReady]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="text-cyan-400 text-xl mb-2">Initializing Three.js...</div>
            <div className="text-cyan-400/60 text-sm">Standard renderer</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="text-red-400 text-xl mb-2">Three.js Failed</div>
            <div className="text-red-400/60 text-sm">{error}</div>
          </div>
        </div>
      )}
      {isReady && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-cyan-500/30">
          <div className="text-cyan-400 text-sm font-mono">
            Three.js | {nodes.length} nodes | {edges.length} edges
          </div>
        </div>
      )}
    </div>
  );
};
