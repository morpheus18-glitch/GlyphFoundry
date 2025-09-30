/**
 * 4D Glyph System - Frontend Types
 * TypeScript definitions matching Python backend
 */

export enum GlyphType {
  // System Metrics
  CPU_METRIC = 'cpu_metric',
  MEMORY_METRIC = 'memory_metric',
  NETWORK_METRIC = 'network_metric',
  DISK_METRIC = 'disk_metric',
  
  // Application Events
  API_REQUEST = 'api_request',
  API_RESPONSE = 'api_response',
  ERROR_EVENT = 'error_event',
  WARNING_EVENT = 'warning_event',
  
  // Knowledge Events
  NODE_CREATED = 'node_created',
  EDGE_CREATED = 'edge_created',
  EMBEDDING_GENERATED = 'embedding_generated',
  QUERY_EXECUTED = 'query_executed',
  
  // User Activity
  USER_LOGIN = 'user_login',
  USER_ACTION = 'user_action',
  CONVERSATION_TURN = 'conversation_turn',
  
  // Custom
  CUSTOM_METRIC = 'custom_metric',
  CUSTOM_EVENT = 'custom_event',
}

export interface TemporalCoordinate {
  x: number;
  y: number;
  z: number;
  t: string; // ISO datetime string
}

export interface GlyphMetadata {
  // Visual properties
  color: string;
  size: number;
  opacity: number;
  intensity: number;
  
  // Shape and pattern
  shape: string;
  pattern?: string;
  
  // Animation
  pulse_speed: number;
  rotation_speed: number;
  
  // Data properties
  value: number;
  unit: string;
  label: string;
  
  // Context
  source: string;
  tenant_id?: string;
  tags: string[];
  
  // Additional
  extra: Record<string, any>;
}

export interface Glyph4D {
  id: string;
  type: GlyphType;
  coordinate: TemporalCoordinate;
  metadata: GlyphMetadata;
  parent_id?: string;
  related_node_id?: string;
  created_at: string;
  expires_at?: string;
}

export interface GlyphStream {
  glyphs: Glyph4D[];
  time_range_start: string;
  time_range_end: string;
  total_count: number;
}

export interface TemporalSlice {
  glyphs: Glyph4D[];
  current_time: string;
  time_window: {
    start: string;
    end: string;
  };
  count: number;
  lod_applied: boolean;
}

export interface GlyphCluster {
  center: { x: number; y: number; z: number };
  glyphs: Glyph4D[];
  count: number;
  dominant_type: string;
}

export interface TimelineBucket {
  timestamp: string;
  count: number;
  types: Record<string, number>;
}

export interface WebGLBuffers {
  positions: number[]; // x, y, z, time_offset (4D)
  colors: number[];    // r, g, b, a
  sizes: number[];
}

export interface GlyphWebGLData {
  buffers: WebGLBuffers;
  metadata: Array<{
    id: string;
    type: string;
    label: string;
    value: number;
  }>;
  count: number;
  current_time: string;
}

/**
 * 4D Navigation State
 * Manages both spatial (x,y,z) and temporal (t) navigation
 */
export interface NavigationState4D {
  // Spatial position
  spatial: {
    x: number;
    y: number;
    z: number;
    zoom: number;
  };
  
  // Temporal position
  temporal: {
    current_time: Date;
    playback_speed: number; // 1.0 = real-time
    is_playing: boolean;
    window_size_seconds: number;
  };
  
  // View settings
  view: {
    show_timeline: boolean;
    show_clusters: boolean;
    show_connections: boolean;
    temporal_fade: boolean;
  };
}

/**
 * Glyph Animation Controller
 */
export interface GlyphAnimation {
  glyph_id: string;
  animation_type: 'pulse' | 'rotate' | 'scale' | 'fade' | 'custom';
  duration_ms: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  loop: boolean;
  params: Record<string, any>;
}

/**
 * Temporal Query for fetching glyphs
 */
export interface TemporalQuery {
  start_time: Date;
  end_time: Date;
  types?: GlyphType[];
  sources?: string[];
  tenant_id?: string;
  limit?: number;
  include_timeline?: boolean;
}
