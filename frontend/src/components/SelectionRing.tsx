import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface SelectionRingProps {
  position: [number, number, number];
  color: string;
  selected: boolean;
}

const ringVertexShader = `
  varying vec2 vUv;
  varying float vDistance;
  
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDistance = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ringFragmentShader = `
  uniform vec3 ringColor;
  uniform float time;
  uniform float selected;
  varying vec2 vUv;
  varying float vDistance;
  
  void main() {
    // Create concentric rings
    float dist = length(vUv - 0.5) * 2.0;
    float ring1 = abs(sin((dist - time * 0.5) * 20.0)) * 0.5;
    float ring2 = abs(sin((dist - time * 0.3) * 15.0)) * 0.3;
    float ring3 = abs(sin((dist + time * 0.7) * 25.0)) * 0.2;
    
    float rings = ring1 + ring2 + ring3;
    
    // Add pulsing glow
    float pulse = 0.6 + 0.4 * sin(time * 4.0);
    
    // Edge fade
    float edgeFade = 1.0 - smoothstep(0.4, 1.0, dist);
    
    // Selection intensity
    float intensity = selected * pulse * rings * edgeFade;
    
    // HDR glow - boost for anime look
    vec3 hdrColor = ringColor * (1.5 + intensity * 3.0);
    
    gl_FragColor = vec4(hdrColor, intensity * 0.8);
  }
`;

export function SelectionRing({ position, color, selected }: SelectionRingProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    ringColor: { value: new THREE.Color(color) },
    time: { value: 0 },
    selected: { value: selected ? 1.0 : 0.0 }
  }), [color]);
  
  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.selected.value = THREE.MathUtils.lerp(
      uniforms.selected.value,
      selected ? 1.0 : 0.0,
      0.1
    );
    
    if (selected) {
      // Animate rings outward when selected
      if (ring1Ref.current) {
        const scale = 1.0 + Math.sin(state.clock.elapsedTime * 2.0) * 0.3;
        ring1Ref.current.scale.setScalar(scale);
      }
      if (ring2Ref.current) {
        const scale = 1.2 + Math.sin(state.clock.elapsedTime * 2.5) * 0.3;
        ring2Ref.current.scale.setScalar(scale);
      }
      if (ring3Ref.current) {
        const scale = 1.4 + Math.sin(state.clock.elapsedTime * 3.0) * 0.3;
        ring3Ref.current.scale.setScalar(scale);
      }
    }
  });
  
  if (!selected) return null;
  
  return (
    <group position={position}>
      {/* Ring 1 - Inner */}
      <mesh ref={ring1Ref}>
        <planeGeometry args={[15, 15]} />
        <shaderMaterial
          vertexShader={ringVertexShader}
          fragmentShader={ringFragmentShader}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Ring 2 - Middle */}
      <mesh ref={ring2Ref}>
        <planeGeometry args={[20, 20]} />
        <shaderMaterial
          vertexShader={ringVertexShader}
          fragmentShader={ringFragmentShader}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Ring 3 - Outer */}
      <mesh ref={ring3Ref}>
        <planeGeometry args={[25, 25]} />
        <shaderMaterial
          vertexShader={ringVertexShader}
          fragmentShader={ringFragmentShader}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Particle burst effect */}
      <SelectionParticles color={color} selected={selected} />
    </group>
  );
}

// Particle burst when node is selected
function SelectionParticles({ color, selected }: { color: string; selected: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  
  const [geometry, material] = useMemo(() => {
    const count = 100;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Random sphere distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 3;
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * 0.2;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * 0.2;
      velocities[i * 3 + 2] = Math.cos(phi) * 0.2;
      
      sizes[i] = Math.random() * 2 + 1;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    return [geo, mat];
  }, [color]);
  
  useFrame((state, delta) => {
    if (!particlesRef.current || !selected) return;
    
    const positions = geometry.attributes.position.array as Float32Array;
    const velocities = geometry.attributes.velocity.array as Float32Array;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i] * delta * 10;
      positions[i + 1] += velocities[i + 1] * delta * 10;
      positions[i + 2] += velocities[i + 2] * delta * 10;
      
      // Reset particles that go too far
      const dist = Math.sqrt(
        positions[i] ** 2 + 
        positions[i + 1] ** 2 + 
        positions[i + 2] ** 2
      );
      
      if (dist > 20) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2;
        
        positions[i] = r * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = r * Math.cos(phi);
      }
    }
    
    geometry.attributes.position.needsUpdate = true;
  });
  
  return (
    <points ref={particlesRef} geometry={geometry} material={material} />
  );
}
