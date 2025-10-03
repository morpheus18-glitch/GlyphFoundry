import { useEffect, useRef, useState, useCallback } from 'react';

export type QualityTier = 'ultra' | 'high' | 'standard' | 'eco';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  isStable: boolean;
}

interface PerformanceMonitorOptions {
  targetFps?: number;
  sampleSize?: number;
  stabilityThreshold?: number;
  onTierChange?: (tier: QualityTier) => void;
}

export function usePerformanceMonitor(options: PerformanceMonitorOptions = {}) {
  const {
    targetFps = 60,
    sampleSize = 60,
    stabilityThreshold = 0.1,
    onTierChange
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    avgFps: 60,
    minFps: 60,
    maxFps: 60,
    isStable: true
  });

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const [currentTier, setCurrentTier] = useState<QualityTier>(isMobile ? 'standard' : 'high');
  
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | undefined>(undefined);
  const consecutiveDropsRef = useRef<number>(0);
  const tierChangeTimerRef = useRef<number>(0);

  const targetFpsThreshold = isMobile ? 30 : 45;

  const determineTier = useCallback((avgFps: number): QualityTier => {
    if (isMobile) {
      if (avgFps >= 30) return 'standard';
      return 'eco';
    } else {
      if (avgFps >= 55) return 'ultra';
      if (avgFps >= 45) return 'high';
      if (avgFps >= 35) return 'standard';
      return 'eco';
    }
  }, [isMobile]);

  const measureFrame = useCallback(() => {
    const now = performance.now();
    const frameTime = now - lastFrameTimeRef.current;
    const fps = 1000 / frameTime;

    frameTimesRef.current.push(frameTime);
    if (frameTimesRef.current.length > sampleSize) {
      frameTimesRef.current.shift();
    }

    const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
    const avgFps = 1000 / avgFrameTime;
    const minFps = 1000 / Math.max(...frameTimesRef.current);
    const maxFps = 1000 / Math.min(...frameTimesRef.current);
    
    const variance = frameTimesRef.current.reduce((acc, ft) => {
      return acc + Math.pow(ft - avgFrameTime, 2);
    }, 0) / frameTimesRef.current.length;
    const stdDev = Math.sqrt(variance);
    const isStable = stdDev / avgFrameTime < stabilityThreshold;

    setMetrics({
      fps: Math.round(fps),
      frameTime: Math.round(frameTime * 100) / 100,
      avgFps: Math.round(avgFps),
      minFps: Math.round(minFps),
      maxFps: Math.round(maxFps),
      isStable
    });

    const now2 = Date.now();
    const newTier = determineTier(avgFps);
    
    if (newTier !== currentTier) {
      const tierOrder: QualityTier[] = ['ultra', 'high', 'standard', 'eco'];
      const currentIndex = tierOrder.indexOf(currentTier);
      const newIndex = tierOrder.indexOf(newTier);
      
      if (newIndex > currentIndex) {
        consecutiveDropsRef.current++;
        
        if (consecutiveDropsRef.current >= 20 && now2 - tierChangeTimerRef.current > 2000) {
          setCurrentTier(newTier);
          tierChangeTimerRef.current = now2;
          consecutiveDropsRef.current = 0;
          onTierChange?.(newTier);
        }
      } else if (newIndex < currentIndex && isStable && now2 - tierChangeTimerRef.current > 5000) {
        setCurrentTier(newTier);
        tierChangeTimerRef.current = now2;
        consecutiveDropsRef.current = 0;
        onTierChange?.(newTier);
      }
    } else {
      consecutiveDropsRef.current = 0;
    }

    lastFrameTimeRef.current = now;
    rafIdRef.current = requestAnimationFrame(measureFrame);
  }, [targetFpsThreshold, sampleSize, stabilityThreshold, currentTier, determineTier, onTierChange]);

  useEffect(() => {
    rafIdRef.current = requestAnimationFrame(measureFrame);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [measureFrame]);

  const setTier = useCallback((tier: QualityTier) => {
    setCurrentTier(tier);
    tierChangeTimerRef.current = Date.now();
    consecutiveDropsRef.current = 0;
    onTierChange?.(tier);
  }, [onTierChange]);

  return {
    metrics,
    currentTier,
    setTier,
    targetFps: targetFpsThreshold,
    isMobile
  };
}
