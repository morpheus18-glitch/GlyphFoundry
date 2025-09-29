import React, { useRef } from 'react';
import { extend, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Extend OrbitControls to use with React Three Fiber
extend({ OrbitControls });

interface OrbitalControlsProps {
  enableZoom?: boolean;
  enableRotate?: boolean;
  enablePan?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  dampingFactor?: number;
}

export function OrbitalControls({
  enableZoom = true,
  enableRotate = true,
  enablePan = true,
  autoRotate = false,
  autoRotateSpeed = 0.5,
  minDistance = 10,
  maxDistance = 2000,
  minPolarAngle = 0,
  maxPolarAngle = Math.PI,
  dampingFactor = 0.05
}: OrbitalControlsProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls>(null);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  return (
    <orbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enableZoom={enableZoom}
      enableRotate={enableRotate}
      enablePan={enablePan}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={minPolarAngle}
      maxPolarAngle={maxPolarAngle}
      enableDamping={true}
      dampingFactor={dampingFactor}
      screenSpacePanning={false}
      rotateSpeed={0.4}
      zoomSpeed={0.6}
      panSpeed={0.8}
      keyPanSpeed={7.0}
    />
  );
}

// Enhanced camera controls for cinematic movement
export function CinematicControls() {
  const { camera } = useThree();
  const targetRef = useRef({ x: 0, y: 0, z: 0 });
  
  useFrame((state) => {
    // Smooth camera interpolation for cinematic feel
    const mouse = state.mouse;
    const time = state.clock.elapsedTime;
    
    // Orbital movement with mouse influence
    const radius = 300 + Math.sin(time * 0.1) * 50;
    const phi = mouse.y * 0.3;
    const theta = mouse.x * 0.3 + time * 0.05;
    
    targetRef.current.x = radius * Math.sin(phi) * Math.cos(theta);
    targetRef.current.y = radius * Math.cos(phi);
    targetRef.current.z = radius * Math.sin(phi) * Math.sin(theta);
    
    // Smooth camera movement
    camera.position.lerp(targetRef.current as any, 0.02);
    camera.lookAt(0, 0, 0);
  });
  
  return null;
}