import { useEffect, useRef, MutableRefObject } from 'react';

interface GestureState {
  isPanning: boolean;
  isZooming: boolean;
  isRotating: boolean;
  lastTouchDistance: number;
  lastTouchAngle: number;
  lastTouchCenter: { x: number; y: number };
  touchStartPoint: { x: number; y: number } | null;
  velocity: { x: number; y: number };
  lastTime: number;
  longPressTimer: number | null;
  longPressTriggered: boolean;
}

interface GraphInstance {
  zoom(ratio: number, center?: { x: number; y: number }): void;
  translate(dx: number, dy: number): void;
  rotate?(angle: number): void;
  fitView?(): void;
  getZoom?(): number;
  getItemByPoint?(x: number, y: number): { id: string } | null;
}

interface GestureCallbacks {
  onNodeLongPress?: (nodeId: string) => void;
  onDoubleTap?: () => void;
}

const LONG_PRESS_DURATION = 500; // ms
const MOVE_THRESHOLD = 10; // px - movement before cancelling long press
const INERTIA_DECAY = 0.92;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_SENSITIVITY = 0.01;
const ROTATION_SENSITIVITY = 0.005;

export const useGraphGestures = (
  containerRef: MutableRefObject<HTMLDivElement | null>,
  graphRef: MutableRefObject<GraphInstance | null>,
  callbacks?: GestureCallbacks
) => {
  const gestureState = useRef<GestureState>({
    isPanning: false,
    isZooming: false,
    isRotating: false,
    lastTouchDistance: 0,
    lastTouchAngle: 0,
    lastTouchCenter: { x: 0, y: 0 },
    touchStartPoint: null,
    velocity: { x: 0, y: 0 },
    lastTime: 0,
    longPressTimer: null,
    longPressTriggered: false
  });

  const inertiaFrame = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  // Vibration API for haptic feedback
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // Calculate distance between two touches
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate angle between two touches
  const getTouchAngle = (touch1: Touch, touch2: Touch): number => {
    return Math.atan2(
      touch2.clientY - touch1.clientY,
      touch2.clientX - touch1.clientX
    );
  };

  // Get center point between two touches
  const getTouchCenter = (touch1: Touch, touch2: Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  // Handle inertial scrolling
  const applyInertia = () => {
    const state = gestureState.current;
    
    if (!graphRef.current || state.isPanning || state.isZooming) {
      inertiaFrame.current = null;
      return;
    }

    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2);
    
    if (speed < 0.1) {
      state.velocity = { x: 0, y: 0 };
      inertiaFrame.current = null;
      return;
    }

    // Apply velocity (already in graph coordinates from pan handler)
    graphRef.current.translate(state.velocity.x, state.velocity.y);
    
    state.velocity.x *= INERTIA_DECAY;
    state.velocity.y *= INERTIA_DECAY;
    
    inertiaFrame.current = requestAnimationFrame(applyInertia);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      const state = gestureState.current;
      const now = Date.now();

      // Clear long press timer
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }

      // Stop inertia
      if (inertiaFrame.current) {
        cancelAnimationFrame(inertiaFrame.current);
        inertiaFrame.current = null;
      }
      state.velocity = { x: 0, y: 0 };

      if (e.touches.length === 1) {
        // Single touch - start tracking for long press or pan
        const touch = e.touches[0];
        state.isPanning = false; // Don't set immediately
        state.touchStartPoint = { x: touch.clientX, y: touch.clientY };
        state.lastTouchCenter = { x: touch.clientX, y: touch.clientY };
        state.lastTime = now;
        state.longPressTriggered = false;

        // Check for double tap
        if (now - lastTapTime.current < 300) {
          vibrate(10);
          callbacks?.onDoubleTap?.();
          if (graphRef.current?.fitView) {
            graphRef.current.fitView();
          }
          lastTapTime.current = 0;
          state.touchStartPoint = null; // Cancel touch start
        } else {
          lastTapTime.current = now;
        }

        // Start long press timer
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        state.longPressTimer = window.setTimeout(() => {
          if (!state.longPressTriggered && graphRef.current && container) {
            state.longPressTriggered = true;
            
            // Convert screen coordinates to container-relative coordinates
            const rect = container.getBoundingClientRect();
            const canvasX = touchX - rect.left;
            const canvasY = touchY - rect.top;
            
            // Hit-test to find node at touch position
            const item = graphRef.current.getItemByPoint?.(canvasX, canvasY);
            if (item && item.id) {
              vibrate([50, 100, 50]); // Pattern: vibrate 50ms, pause 100ms, vibrate 50ms
              callbacks?.onNodeLongPress?.(item.id);
            }
          }
        }, LONG_PRESS_DURATION);

      } else if (e.touches.length === 2) {
        // Two touches - zoom and rotate
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        state.isZooming = true;
        state.isRotating = true;
        state.isPanning = false;
        state.lastTouchDistance = getTouchDistance(touch1, touch2);
        state.lastTouchAngle = getTouchAngle(touch1, touch2);
        state.lastTouchCenter = getTouchCenter(touch1, touch2);

        // Cancel long press on second touch
        if (state.longPressTimer) {
          clearTimeout(state.longPressTimer);
          state.longPressTimer = null;
        }

        vibrate(10); // Light haptic on multi-touch start
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = gestureState.current;
      const now = Date.now();

      if (e.touches.length === 1 && !state.longPressTriggered && state.touchStartPoint) {
        // Single touch - check movement threshold
        const touch = e.touches[0];
        const dx = touch.clientX - state.touchStartPoint.x;
        const dy = touch.clientY - state.touchStartPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Cancel long press if moved beyond threshold
        if (distance > MOVE_THRESHOLD && state.longPressTimer) {
          clearTimeout(state.longPressTimer);
          state.longPressTimer = null;
          state.isPanning = true; // Now we can start panning
        }

        // Only pan if we've exceeded threshold
        if (state.isPanning && graphRef.current) {
          const frameDx = touch.clientX - state.lastTouchCenter.x;
          const frameDy = touch.clientY - state.lastTouchCenter.y;
          const dt = Math.max(now - state.lastTime, 1);

          // Convert screen delta to graph delta (account for zoom)
          const zoom = graphRef.current.getZoom?.() || 1;
          const graphDx = frameDx / zoom;
          const graphDy = frameDy / zoom;

          // Translate the graph
          graphRef.current.translate(graphDx, graphDy);

          // Calculate velocity for inertia (in graph coordinates)
          state.velocity = {
            x: graphDx / dt * 16, // Normalize to ~60fps
            y: graphDy / dt * 16
          };

          state.lastTouchCenter = { x: touch.clientX, y: touch.clientY };
          state.lastTime = now;
        }

      } else if (e.touches.length === 2 && (state.isZooming || state.isRotating)) {
        // Two touch zoom and rotate
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const currentDistance = getTouchDistance(touch1, touch2);
        const currentAngle = getTouchAngle(touch1, touch2);
        const currentCenter = getTouchCenter(touch1, touch2);

        if (state.isZooming && graphRef.current && container) {
          const deltaDistance = currentDistance - state.lastTouchDistance;
          const zoomDelta = 1 + (deltaDistance * ZOOM_SENSITIVITY);
          
          // Get current zoom level
          const currentZoom = graphRef.current.getZoom?.() || 1;
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * zoomDelta));
          
          if (currentZoom !== newZoom) {
            // Convert screen coordinates to container-relative coordinates
            const rect = container.getBoundingClientRect();
            const canvasX = currentCenter.x - rect.left;
            const canvasY = currentCenter.y - rect.top;
            
            graphRef.current.zoom(newZoom / currentZoom, {
              x: canvasX,
              y: canvasY
            });

            // Haptic feedback on zoom milestones
            if (Math.abs(newZoom - 1.0) < 0.05 && Math.abs(currentZoom - 1.0) >= 0.05) {
              vibrate(20); // Light vibration when passing 1x zoom
            }
          }

          state.lastTouchDistance = currentDistance;
        }

        if (state.isRotating && graphRef.current?.rotate) {
          const deltaAngle = currentAngle - state.lastTouchAngle;
          graphRef.current.rotate(deltaAngle * ROTATION_SENSITIVITY);
          state.lastTouchAngle = currentAngle;
        }

        state.lastTouchCenter = currentCenter;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = gestureState.current;

      // Clear long press timer
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }

      if (e.touches.length === 0) {
        // All touches released
        if (state.isPanning && !state.longPressTriggered) {
          // Apply inertia
          const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2);
          if (speed > 1) {
            inertiaFrame.current = requestAnimationFrame(applyInertia);
          }
        }

        state.isPanning = false;
        state.isZooming = false;
        state.isRotating = false;
        state.longPressTriggered = false;

      } else if (e.touches.length === 1) {
        // Back to single touch
        const touch = e.touches[0];
        state.isPanning = true;
        state.isZooming = false;
        state.isRotating = false;
        state.lastTouchCenter = { x: touch.clientX, y: touch.clientY };
        state.lastTime = Date.now();
        state.velocity = { x: 0, y: 0 };
      }
    };

    const handleTouchCancel = (e: TouchEvent) => {
      const state = gestureState.current;
      
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }

      if (inertiaFrame.current) {
        cancelAnimationFrame(inertiaFrame.current);
        inertiaFrame.current = null;
      }

      state.isPanning = false;
      state.isZooming = false;
      state.isRotating = false;
      state.velocity = { x: 0, y: 0 };
      state.longPressTriggered = false;
    };

    // Add event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchCancel);

    // Cleanup
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);

      if (gestureState.current.longPressTimer) {
        clearTimeout(gestureState.current.longPressTimer);
      }

      if (inertiaFrame.current) {
        cancelAnimationFrame(inertiaFrame.current);
      }
    };
  }, [containerRef, graphRef, callbacks]);

  return {
    // Expose gesture state for debugging if needed
    isGestureActive: () => {
      const state = gestureState.current;
      return state.isPanning || state.isZooming || state.isRotating;
    }
  };
};
