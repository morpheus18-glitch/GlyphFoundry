import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export const VolumetricSun = forwardRef<THREE.Mesh, {}>((props, forwardedRef) => {
  const sunRef = useRef<THREE.Mesh>(null);
  
  useImperativeHandle(forwardedRef, () => sunRef.current as THREE.Mesh, []);
  
  useFrame((state) => {
    if (sunRef.current) {
      // Gentle pulsing effect for the sun
      const pulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 1;
      sunRef.current.scale.setScalar(pulse);
    }
  });
  
  return (
    <mesh ref={sunRef} position={[1000, 800, -500]}>
      <sphereGeometry args={[40, 32, 32]} />
      <meshBasicMaterial 
        color="#4ecdc4" 
        toneMapped={false}
      />
      <pointLight 
        intensity={3} 
        distance={2000} 
        decay={2} 
        color="#4ecdc4"
        castShadow
      />
    </mesh>
  );
});
