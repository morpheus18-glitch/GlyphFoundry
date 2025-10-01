import React, { useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom, DepthOfField, SMAA, ChromaticAberration, GodRays, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

interface CinematicEffectsProps {
  sunRef?: React.RefObject<THREE.Mesh | null>;
  useDOF?: boolean;
}

export function CinematicEffects({ sunRef, useDOF = true }: CinematicEffectsProps) {
  const hasGodRays = sunRef?.current !== null && sunRef?.current !== undefined;
  
  // Render with god rays when sun reference is available
  if (hasGodRays && sunRef?.current) {
    // Include DOF when requested for close-up cinematic focus
    if (useDOF) {
      return (
        <EffectComposer multisampling={8} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
          <Bloom 
            intensity={2.8} 
            luminanceThreshold={0.08} 
            luminanceSmoothing={0.95}
            mipmapBlur={true}
            radius={1.3}
            levels={9}
            kernelSize={KernelSize.LARGE}
          />
          <GodRays
            sun={sunRef.current}
            blendFunction={BlendFunction.SCREEN}
            samples={60}
            density={0.97}
            decay={0.96}
            weight={0.6}
            exposure={0.4}
            clampMax={1}
          />
          <DepthOfField 
            focusDistance={0.008} 
            focalLength={0.015} 
            bokehScale={4.5}
            height={700}
          />
          <ChromaticAberration 
            offset={[0.002, 0.002]}
            blendFunction={BlendFunction.NORMAL}
          />
          <Vignette 
            offset={0.3} 
            darkness={0.6}
            blendFunction={BlendFunction.NORMAL}
          />
          <SMAA />
        </EffectComposer>
      );
    }
    
    // God rays without DOF for far LOD
    return (
      <EffectComposer multisampling={8} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
        <Bloom 
          intensity={3.5} 
          luminanceThreshold={0.05} 
          luminanceSmoothing={0.92}
          mipmapBlur={true}
          radius={1.6}
          levels={9}
          kernelSize={KernelSize.LARGE}
        />
        <GodRays
          sun={sunRef.current}
          blendFunction={BlendFunction.SCREEN}
          samples={60}
          density={0.97}
          decay={0.96}
          weight={0.6}
          exposure={0.4}
          clampMax={1}
        />
        <ChromaticAberration 
          offset={[0.002, 0.002]}
          blendFunction={BlendFunction.NORMAL}
        />
        <Vignette 
          offset={0.3} 
          darkness={0.6}
          blendFunction={BlendFunction.NORMAL}
        />
        <SMAA />
      </EffectComposer>
    );
  }
  
  // Without god rays - still respects useDOF
  if (useDOF) {
    return (
      <EffectComposer multisampling={8} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
        <Bloom 
          intensity={3.5} 
          luminanceThreshold={0.05} 
          luminanceSmoothing={0.92}
          mipmapBlur={true}
          radius={1.6}
          levels={9}
          kernelSize={KernelSize.LARGE}
        />
        <DepthOfField 
          focusDistance={0.008} 
          focalLength={0.015} 
          bokehScale={4.5}
          height={700}
        />
        <ChromaticAberration 
          offset={[0.002, 0.002]}
          blendFunction={BlendFunction.NORMAL}
        />
        <Vignette 
          offset={0.3} 
          darkness={0.6}
          blendFunction={BlendFunction.NORMAL}
        />
        <SMAA />
      </EffectComposer>
    );
  }
  
  // Far LOD: No DOF
  return (
    <EffectComposer multisampling={8} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      <Bloom 
        intensity={2.8} 
        luminanceThreshold={0.08} 
        luminanceSmoothing={0.95}
        mipmapBlur={true}
        radius={1.3}
        levels={9}
        kernelSize={KernelSize.LARGE}
      />
      <ChromaticAberration 
        offset={[0.002, 0.002]}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette 
        offset={0.3} 
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
      <SMAA />
    </EffectComposer>
  );
}
