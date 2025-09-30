/**
 * 4D Glyph Visualization Component
 * High-performance instanced rendering for thousands of glyphs
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GlyphWebGLData, NavigationState4D } from './types';

interface GlyphVisualization4DProps {
  glyphData: GlyphWebGLData;
  navigationState: NavigationState4D;
  onGlyphClick?: (glyphId: string) => void;
  onGlyphHover?: (glyphId: string | null) => void;
}

export function GlyphVisualization4D({
  glyphData,
  navigationState,
  onGlyphClick,
  onGlyphHover
}: GlyphVisualization4DProps) {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Create geometry (shared by all instances)
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  
  // Create instanced material with custom shader
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        temporalFade: { value: navigationState.view.temporal_fade ? 1.0 : 0.0 }
      },
      vertexShader: `
        uniform float time;
        uniform float temporalFade;
        
        attribute vec4 instanceColor;
        attribute float instanceSize;
        attribute float instanceTimeOffset;
        
        varying vec4 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Apply temporal fade based on time distance
          float timeDist = abs(instanceTimeOffset);
          float fadeAmount = temporalFade * (1.0 - clamp(timeDist / 300.0, 0.0, 1.0));
          vColor = vec4(instanceColor.rgb, instanceColor.a * (0.3 + fadeAmount * 0.7));
          
          // Pulse animation based on time
          float pulse = 1.0 + sin(time * 2.0 + timeDist * 0.1) * 0.1;
          
          // Transform position with instance matrix and size
          vec3 transformed = position * instanceSize * pulse;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
          
          vNormal = normalize(normalMatrix * normal);
          vPosition = mvPosition.xyz;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec4 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Fresnel glow effect
          vec3 viewDir = normalize(-vPosition);
          float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
          float glow = 0.5 + fresnel * 0.5;
          
          gl_FragColor = vec4(vColor.rgb * glow, vColor.a);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }, [navigationState.view.temporal_fade]);
  
  // Update instance attributes from buffer data
  useEffect(() => {
    if (!glyphData?.buffers || !instancedMeshRef.current) return;
    
    const { positions, colors, sizes } = glyphData.buffers;
    const count = glyphData.count;
    
    // Set instance count
    instancedMeshRef.current.count = count;
    
    // Create instance attributes
    const instanceColors = new Float32Array(count * 4);
    const instanceSizes = new Float32Array(count);
    const instanceTimeOffsets = new Float32Array(count);
    
    // Create instance matrices
    const matrix = new THREE.Matrix4();
    
    for (let i = 0; i < count; i++) {
      const posIdx = i * 4;
      const x = positions[posIdx];
      const y = positions[posIdx + 1];
      const z = positions[posIdx + 2];
      const timeOffset = positions[posIdx + 3];
      
      // Set position in instance matrix
      matrix.setPosition(x, y, z);
      instancedMeshRef.current.setMatrixAt(i, matrix);
      
      // Set color
      const colorIdx = i * 4;
      instanceColors[colorIdx] = colors[colorIdx];
      instanceColors[colorIdx + 1] = colors[colorIdx + 1];
      instanceColors[colorIdx + 2] = colors[colorIdx + 2];
      instanceColors[colorIdx + 3] = colors[colorIdx + 3];
      
      // Set size and time offset
      instanceSizes[i] = sizes[i];
      instanceTimeOffsets[i] = timeOffset;
    }
    
    // Update geometry attributes
    geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 4));
    geometry.setAttribute('instanceSize', new THREE.InstancedBufferAttribute(instanceSizes, 1));
    geometry.setAttribute('instanceTimeOffset', new THREE.InstancedBufferAttribute(instanceTimeOffsets, 1));
    
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [glyphData, geometry]);
  
  // Animation loop
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });
  
  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[geometry, material, glyphData?.count || 0]}
      material={material}
    >
      <primitive object={material} ref={materialRef} attach="material" />
    </instancedMesh>
  );
}

/**
 * Individual Glyph Component (for non-instanced rendering)
 */
interface GlyphNodeProps {
  glyph: Glyph4D;
  currentTime: Date;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
}

export function GlyphNode({ glyph, currentTime, onClick, onHover }: GlyphNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Calculate time offset from current time
  const timeOffset = useMemo(() => {
    const glyphTime = new Date(glyph.coordinate.t);
    return (glyphTime.getTime() - currentTime.getTime()) / 1000;
  }, [glyph.coordinate.t, currentTime]);
  
  // Parse color
  const color = useMemo(() => {
    return new THREE.Color(glyph.metadata.color);
  }, [glyph.metadata.color]);
  
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    // Pulse animation
    const pulse = 1.0 + Math.sin(clock.elapsedTime * glyph.metadata.pulse_speed) * 0.1;
    meshRef.current.scale.setScalar(glyph.metadata.size * pulse);
    
    // Rotation if specified
    if (glyph.metadata.rotation_speed > 0) {
      meshRef.current.rotation.y += glyph.metadata.rotation_speed * 0.01;
    }
  });
  
  return (
    <mesh
      ref={meshRef}
      position={[glyph.coordinate.x, glyph.coordinate.y, glyph.coordinate.z]}
      onClick={onClick}
      onPointerOver={() => onHover?.(true)}
      onPointerOut={() => onHover?.(false)}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glyph.metadata.intensity}
        transparent
        opacity={glyph.metadata.opacity}
      />
    </mesh>
  );
}
