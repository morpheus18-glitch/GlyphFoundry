import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';

interface NeonWispNodeProps {
  position: [number, number, number];
  color: string;
  size: number;
  glow: number;
  importance: number;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
}

// Custom glow shader for neon wisps
const glowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPositionNormal;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragmentShader = `
  uniform vec3 glowColor;
  uniform float glowIntensity;
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPositionNormal;
  
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vPositionNormal)), 2.0);
    float pulse = 0.8 + 0.2 * sin(time * 3.0);
    float glow = fresnel * glowIntensity * pulse;
    
    gl_FragColor = vec4(glowColor, glow);
  }
`;

// Particle trail shader for energy wisps
const trailVertexShader = `
  attribute float size;
  attribute vec3 customColor;
  varying vec3 vColor;
  
  void main() {
    vColor = customColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const trailFragmentShader = `
  uniform float time;
  varying vec3 vColor;
  
  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float alpha = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
    float pulse = 0.7 + 0.3 * sin(time * 5.0);
    
    gl_FragColor = vec4(vColor * pulse, alpha * 0.8);
  }
`;

export function NeonWispNode({
  position,
  color,
  size,
  glow,
  importance,
  onClick,
  onHover
}: NeonWispNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);
  
  const [glowUniforms, trailGeometry] = useMemo(() => {
    const glowUniforms = {
      glowColor: { value: new THREE.Color(color) },
      glowIntensity: { value: glow + importance * 0.5 },
      time: { value: 0 }
    };
    
    // Create energy trail particles around the node
    const particleCount = Math.floor(20 + importance * 30);
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    
    const nodeColor = new THREE.Color(color);
    const brightColor = nodeColor.clone().multiplyScalar(1.5);
    
    for (let i = 0; i < particleCount; i++) {
      // Create spiral pattern around node
      const angle = (i / particleCount) * Math.PI * 4;
      const radius = (size * 2) + (i / particleCount) * size * 3;
      const height = Math.sin(angle * 2) * size;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      
      sizes[i] = (Math.random() * 0.5 + 0.5) * size * 0.3;
      
      // Vary between base color and bright color
      const mixFactor = Math.random();
      const finalColor = nodeColor.clone().lerp(brightColor, mixFactor);
      colors[i * 3] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    
    return [glowUniforms, geometry];
  }, [color, size, glow, importance]);
  
  const trailUniforms = useMemo(() => ({
    time: { value: 0 }
  }), []);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = position[1] + Math.sin(time * 0.5 + position[0]) * 0.5;
      groupRef.current.rotation.y = time * 0.1;
    }
    
    if (glowRef.current) {
      glowUniforms.time.value = time;
    }
    
    if (trailRef.current) {
      trailUniforms.time.value = time;
      trailRef.current.rotation.y = time * 0.3;
      trailRef.current.rotation.z = time * 0.2;
    }
  });
  
  const baseSize = size * (1 + importance * 0.5);
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={onClick}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
    >
      {/* Core node sphere */}
      <Sphere args={[baseSize, 32, 32]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3 + importance * 0.2}
          transparent={true}
          opacity={0.8}
        />
      </Sphere>
      
      {/* Glow layer */}
      <Sphere args={[baseSize * 1.5, 32, 32]} ref={glowRef}>
        <shaderMaterial
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          uniforms={glowUniforms}
          transparent={true}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Energy trail particles */}
      <points ref={trailRef} geometry={trailGeometry}>
        <shaderMaterial
          vertexShader={trailVertexShader}
          fragmentShader={trailFragmentShader}
          uniforms={trailUniforms}
          transparent={true}
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* Outer glow halo */}
      <Sphere args={[baseSize * 2.5, 16, 16]}>
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0.1 + importance * 0.1}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
    </group>
  );
}