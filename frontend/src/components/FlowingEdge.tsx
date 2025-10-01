import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface FlowingEdgeProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color?: string;
  speed?: number;
  particleCount?: number;
}

export function FlowingEdge({
  start,
  end,
  color = '#00ffff',
  speed = 1.0,
  particleCount = 20
}: FlowingEdgeProps) {
  const particlesRef = useRef<THREE.Points>(null);
  const lineRef = useRef<THREE.Line>(null);
  
  const [particleGeometry, lineMaterial] = useMemo(() => {
    // Particle geometry for flowing effect
    const positions = new Float32Array(particleCount * 3);
    const progress = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    
    const baseColor = new THREE.Color(color);
    const brightColor = baseColor.clone().multiplyScalar(2.0);
    
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      progress[i] = t;
      sizes[i] = 0.5 + Math.random() * 1.5;
      
      // Gradient color along the edge
      const edgeColor = baseColor.clone().lerp(brightColor, t);
      colors[i * 3] = edgeColor.r;
      colors[i * 3 + 1] = edgeColor.g;
      colors[i * 3 + 2] = edgeColor.b;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('progress', new THREE.BufferAttribute(progress, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Line material for the base connection
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      linewidth: 2
    });
    
    return [geo, mat];
  }, [color, particleCount]);
  
  const particleMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false,
      sizeAttenuation: true
    });
  }, []);
  
  // Update positions every frame for flowing animation
  useFrame((state, delta) => {
    if (!particlesRef.current) return;
    
    const positions = particleGeometry.attributes.position.array as Float32Array;
    const progressAttr = particleGeometry.attributes.progress.array as Float32Array;
    
    const direction = end.clone().sub(start);
    const length = direction.length();
    direction.normalize();
    
    for (let i = 0; i < particleCount; i++) {
      // Update progress along the edge
      progressAttr[i] = (progressAttr[i] + delta * speed * 0.3) % 1.0;
      
      // Calculate position along the line with some wave motion
      const t = progressAttr[i];
      const waveOffset = Math.sin(t * Math.PI * 4 + state.clock.elapsedTime * 2) * 0.5;
      
      const pos = start.clone().add(
        direction.clone().multiplyScalar(t * length)
      );
      
      // Add perpendicular wave motion
      const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
      pos.add(perpendicular.multiplyScalar(waveOffset));
      
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
    }
    
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.progress.needsUpdate = true;
  });
  
  // Create line geometry
  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    return geo;
  }, [start, end]);
  
  return (
    <group>
      {/* Base line */}
      <primitive 
        ref={lineRef}
        object={new THREE.Line(lineGeometry, lineMaterial)} 
      />
      
      {/* Flowing particles */}
      <points 
        ref={particlesRef} 
        geometry={particleGeometry} 
        material={particleMaterial}
      />
    </group>
  );
}

// Component to render multiple flowing edges efficiently
interface FlowingEdgesProps {
  edges: Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    color?: string;
  }>;
}

export function FlowingEdges({ edges }: FlowingEdgesProps) {
  return (
    <>
      {edges.map((edge, i) => (
        <FlowingEdge
          key={i}
          start={edge.start}
          end={edge.end}
          color={edge.color}
          speed={0.8 + Math.random() * 0.4}
        />
      ))}
    </>
  );
}
