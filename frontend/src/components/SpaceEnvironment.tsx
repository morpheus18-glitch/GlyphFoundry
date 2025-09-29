import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sphere, Stars } from '@react-three/drei';

// Custom space shader for HDR starfield background
const spaceVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spaceFragmentShader = `
  uniform float time;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  varying vec2 vUv;
  varying vec3 vPosition;
  
  // Noise function for nebula-like effects
  float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
  }
  
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 6; i++) {
      value += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  void main() {
    vec3 pos = vPosition * 0.1 + vec3(time * 0.01);
    
    // Create deep space gradient
    float gradient = length(vUv - 0.5);
    
    // Nebula clouds
    float nebula1 = fbm(pos + time * 0.02);
    float nebula2 = fbm(pos * 2.0 - time * 0.015);
    
    // Color mixing for space depth
    vec3 deepSpace = mix(color1, color2, gradient);
    vec3 nebula = mix(color2, color3, nebula1 * nebula2);
    
    // Final space color with subtle animation
    vec3 spaceColor = mix(deepSpace, nebula, nebula1 * 0.3);
    
    // Add subtle brightness variation
    float brightness = 0.8 + 0.2 * sin(time * 0.5 + gradient * 10.0);
    
    gl_FragColor = vec4(spaceColor * brightness, 1.0);
  }
`;

export function SpaceEnvironment() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    color1: { value: new THREE.Color('#000511') }, // Deep space blue
    color2: { value: new THREE.Color('#200033') }, // Dark purple
    color3: { value: new THREE.Color('#4a0080') }, // Nebula purple
  }), []);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });
  
  return (
    <>
      {/* Deep space background sphere */}
      <Sphere args={[1000, 64, 64]} position={[0, 0, 0]}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={spaceVertexShader}
          fragmentShader={spaceFragmentShader}
          uniforms={uniforms}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Dense starfield */}
      <Stars 
        radius={800} 
        depth={200} 
        count={15000} 
        factor={8} 
        saturation={0.8}
        fade={true}
        speed={0.5}
      />
      
      {/* Additional distant stars */}
      <Stars 
        radius={1200} 
        depth={300} 
        count={8000} 
        factor={12} 
        saturation={0.4}
        fade={true}
        speed={0.2}
      />
      
      {/* Nebula particles */}
      <NebulaParticles />
    </>
  );
}

function NebulaParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  
  const [positions, colors] = useMemo(() => {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    const nebulaColors = [
      new THREE.Color('#ff6b9d'), // Pink
      new THREE.Color('#4ecdc4'), // Cyan  
      new THREE.Color('#45b7d1'), // Blue
      new THREE.Color('#f9ca24'), // Gold
      new THREE.Color('#6c5ce7'), // Purple
    ];
    
    for (let i = 0; i < count; i++) {
      // Distribute in galaxy-like spiral pattern
      const angle = (i / count) * Math.PI * 8;
      const radius = (i / count) * 400 + Math.random() * 100;
      const height = (Math.random() - 0.5) * 50;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      
      const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    return [positions, colors];
  }, []);
  
  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={3}
        sizeAttenuation={true}
        vertexColors={true}
        transparent={true}
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}