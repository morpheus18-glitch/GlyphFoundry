/**
 * Temporal Navigator Component
 * Controls for 4D navigation (3D space + time)
 */

import React, { useState, useEffect } from 'react';
import { NavigationState4D, TemporalQuery } from './types';

interface TemporalNavigatorProps {
  navigationState: NavigationState4D;
  onNavigationChange: (state: NavigationState4D) => void;
  onQueryChange: (query: TemporalQuery) => void;
  timeRange: { start: Date; end: Date };
}

export function TemporalNavigator({
  navigationState,
  onNavigationChange,
  onQueryChange,
  timeRange
}: TemporalNavigatorProps) {
  const [localTime, setLocalTime] = useState(navigationState.temporal.current_time);
  const [playbackSpeed, setPlaybackSpeed] = useState(navigationState.temporal.playback_speed);
  
  // Playback control
  useEffect(() => {
    if (!navigationState.temporal.is_playing) return;
    
    const interval = setInterval(() => {
      const newTime = new Date(localTime.getTime() + 1000 * playbackSpeed);
      
      if (newTime > timeRange.end) {
        // Loop back to start
        setLocalTime(timeRange.start);
      } else {
        setLocalTime(newTime);
      }
      
      onNavigationChange({
        ...navigationState,
        temporal: {
          ...navigationState.temporal,
          current_time: newTime
        }
      });
    }, 1000 / 60); // 60 FPS
    
    return () => clearInterval(interval);
  }, [navigationState, localTime, playbackSpeed, timeRange, onNavigationChange]);
  
  const handlePlayPause = () => {
    onNavigationChange({
      ...navigationState,
      temporal: {
        ...navigationState.temporal,
        is_playing: !navigationState.temporal.is_playing
      }
    });
  };
  
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    onNavigationChange({
      ...navigationState,
      temporal: {
        ...navigationState.temporal,
        playback_speed: speed
      }
    });
  };
  
  const handleTimeSeek = (time: Date) => {
    setLocalTime(time);
    onNavigationChange({
      ...navigationState,
      temporal: {
        ...navigationState.temporal,
        current_time: time
      }
    });
  };
  
  const handleWindowSizeChange = (seconds: number) => {
    onNavigationChange({
      ...navigationState,
      temporal: {
        ...navigationState.temporal,
        window_size_seconds: seconds
      }
    });
  };
  
  return (
    <div className="temporal-navigator">
      {/* Time Display */}
      <div className="time-display">
        <div className="current-time">
          {localTime.toLocaleString()}
        </div>
        <div className="time-range">
          <span>{timeRange.start.toLocaleTimeString()}</span>
          {' - '}
          <span>{timeRange.end.toLocaleTimeString()}</span>
        </div>
      </div>
      
      {/* Timeline Scrubber */}
      <div className="timeline-scrubber">
        <input
          type="range"
          min={timeRange.start.getTime()}
          max={timeRange.end.getTime()}
          value={localTime.getTime()}
          onChange={(e) => handleTimeSeek(new Date(parseInt(e.target.value)))}
          className="timeline-slider"
        />
      </div>
      
      {/* Playback Controls */}
      <div className="playback-controls">
        <button
          onClick={handlePlayPause}
          className="play-pause-btn"
        >
          {navigationState.temporal.is_playing ? '⏸' : '▶'}
        </button>
        
        <div className="speed-controls">
          <label>Speed:</label>
          <button onClick={() => handleSpeedChange(0.5)}>0.5x</button>
          <button onClick={() => handleSpeedChange(1.0)}>1x</button>
          <button onClick={() => handleSpeedChange(2.0)}>2x</button>
          <button onClick={() => handleSpeedChange(5.0)}>5x</button>
          <button onClick={() => handleSpeedChange(10.0)}>10x</button>
        </div>
      </div>
      
      {/* Window Size Control */}
      <div className="window-controls">
        <label>Time Window:</label>
        <select
          value={navigationState.temporal.window_size_seconds}
          onChange={(e) => handleWindowSizeChange(parseInt(e.target.value))}
        >
          <option value={60}>1 minute</option>
          <option value={300}>5 minutes</option>
          <option value={900}>15 minutes</option>
          <option value={1800}>30 minutes</option>
          <option value={3600}>1 hour</option>
          <option value={21600}>6 hours</option>
          <option value={86400}>24 hours</option>
        </select>
      </div>
      
      {/* View Options */}
      <div className="view-options">
        <label>
          <input
            type="checkbox"
            checked={navigationState.view.show_timeline}
            onChange={(e) => onNavigationChange({
              ...navigationState,
              view: { ...navigationState.view, show_timeline: e.target.checked }
            })}
          />
          Show Timeline
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={navigationState.view.show_clusters}
            onChange={(e) => onNavigationChange({
              ...navigationState,
              view: { ...navigationState.view, show_clusters: e.target.checked }
            })}
          />
          Show Clusters
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={navigationState.view.temporal_fade}
            onChange={(e) => onNavigationChange({
              ...navigationState,
              view: { ...navigationState.view, temporal_fade: e.target.checked }
            })}
          />
          Temporal Fade
        </label>
      </div>
      
      <style jsx>{`
        .temporal-navigator {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          padding: 20px;
          border-radius: 12px;
          color: white;
          min-width: 600px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .time-display {
          text-align: center;
          margin-bottom: 15px;
        }
        
        .current-time {
          font-size: 1.2em;
          font-weight: bold;
          color: #4ecdc4;
          margin-bottom: 5px;
        }
        
        .time-range {
          font-size: 0.9em;
          opacity: 0.7;
        }
        
        .timeline-scrubber {
          margin: 15px 0;
        }
        
        .timeline-slider {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          outline: none;
          border-radius: 3px;
        }
        
        .timeline-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #4ecdc4;
          border-radius: 50%;
          cursor: pointer;
        }
        
        .playback-controls {
          display: flex;
          align-items: center;
          gap: 15px;
          margin: 15px 0;
        }
        
        .play-pause-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #4ecdc4;
          border: none;
          color: white;
          font-size: 1.2em;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .play-pause-btn:hover {
          background: #45b7d1;
          transform: scale(1.1);
        }
        
        .speed-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .speed-controls button {
          padding: 5px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .speed-controls button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .window-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 15px 0;
        }
        
        .window-controls select {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
        }
        
        .view-options {
          display: flex;
          gap: 20px;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .view-options label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .view-options input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
