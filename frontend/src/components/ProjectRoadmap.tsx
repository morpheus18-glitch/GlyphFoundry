import React from 'react';

interface Task {
  id: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
  duration: string;
  dependencies?: string[];
  complexity: 'low' | 'medium' | 'high' | 'critical';
  target?: string;
  mobileImpact?: string;
}

interface Phase {
  id: number;
  name: string;
  goal: string;
  duration: string;
  status: 'completed' | 'in_progress' | 'pending';
  tasks: Task[];
  completion: number;
}

const ROADMAP_DATA: Phase[] = [
  {
    id: 1,
    name: 'Performance Foundations',
    goal: '50k-100k nodes at 45+ FPS desktop, 30+ FPS mobile',
    duration: '5-7 weeks',
    status: 'in_progress',
    completion: 12.5,
    tasks: [
      {
        id: 'task1',
        title: 'G6 5.0 WebGL Renderer',
        status: 'completed',
        duration: 'Complete',
        complexity: 'high',
        target: 'GPU-accelerated rendering with birth animations'
      },
      {
        id: 'task2',
        title: 'Rust Wasm Physics Engine',
        status: 'pending',
        duration: '5-7 days',
        complexity: 'critical',
        target: '<30ms layout for 50k nodes',
        mobileImpact: 'Memory cap + JS fallback for iOS Safari'
      },
      {
        id: 'task3',
        title: 'Adaptive Rendering System',
        status: 'pending',
        duration: '3-4 days',
        dependencies: ['task2'],
        complexity: 'high',
        target: '≥45 FPS desktop, ≥30 FPS mobile',
        mobileImpact: 'Auto-switch quality tiers (Ultra→Eco)'
      },
      {
        id: 'task4',
        title: 'Mobile Touch Controls',
        status: 'pending',
        duration: '3 days',
        complexity: 'medium',
        target: '60 FPS gesture budget',
        mobileImpact: 'Pinch-zoom, pan, rotate, haptics'
      },
      {
        id: 'task5',
        title: 'Viewport Culling & Lazy Loading',
        status: 'pending',
        duration: '6-8 days',
        dependencies: ['task2'],
        complexity: 'critical',
        target: '1M nodes, render ≤50k simultaneously',
        mobileImpact: 'Aggressive LOD defaults'
      },
      {
        id: 'task6',
        title: 'Wasm-G6 Integration Bridge',
        status: 'pending',
        duration: '3-5 days',
        dependencies: ['task2', 'task5'],
        complexity: 'high',
        target: '≤16ms physics tick desktop, ≤25ms mobile'
      },
      {
        id: 'task7',
        title: 'Cinematic Effects (Bloom, God Rays)',
        status: 'pending',
        duration: '4-6 days',
        dependencies: ['task3'],
        complexity: 'high',
        target: 'HDR neon on pure black, quality-tier aware',
        mobileImpact: 'Eco disables effects, Standard = bloom only'
      },
      {
        id: 'task8',
        title: 'Cross-Device Testing & Optimization',
        status: 'pending',
        duration: '5 days',
        dependencies: ['task2', 'task3', 'task4', 'task5', 'task6', 'task7'],
        complexity: 'medium',
        target: 'iOS/Android/Desktop validation'
      }
    ]
  },
  {
    id: 2,
    name: 'Intelligent Interaction Layer',
    goal: '100k node real-time interaction with intelligent features',
    duration: '4-6 weeks',
    status: 'pending',
    completion: 0,
    tasks: [
      {
        id: 'p2-semantic',
        title: 'Semantic Search Overlays',
        status: 'pending',
        duration: '1-2 weeks',
        complexity: 'high',
        target: 'Real-time search with 3D highlighting'
      },
      {
        id: 'p2-timeline',
        title: 'Graph Storytelling Timelines',
        status: 'pending',
        duration: '1-2 weeks',
        complexity: 'medium',
        target: 'Temporal navigation through knowledge'
      },
      {
        id: 'p2-collab',
        title: 'Collaborative Annotations',
        status: 'pending',
        duration: '1-2 weeks',
        complexity: 'medium',
        target: 'Multi-user comments and highlights'
      },
      {
        id: 'p2-ai',
        title: 'AI-Powered Insights',
        status: 'pending',
        duration: '2 weeks',
        complexity: 'high',
        target: 'Auto cluster detection and suggestions'
      }
    ]
  },
  {
    id: 3,
    name: 'Enterprise Scale + Governance',
    goal: '500k nodes live, 1M+ streaming via culling',
    duration: '6-8 weeks',
    status: 'pending',
    completion: 0,
    tasks: [
      {
        id: 'p3-acl',
        title: 'Multi-Tenant ACL Heatmaps',
        status: 'pending',
        duration: '2 weeks',
        complexity: 'critical',
        target: 'Role-based access with visual overlays'
      },
      {
        id: 'p3-audit',
        title: 'Audit Trails & Compliance',
        status: 'pending',
        duration: '1-2 weeks',
        complexity: 'medium',
        target: 'Complete change tracking'
      },
      {
        id: 'p3-sso',
        title: 'SSO Integration (SAML/OAuth)',
        status: 'pending',
        duration: '1 week',
        complexity: 'medium',
        target: 'Enterprise IdP support'
      },
      {
        id: 'p3-pipelines',
        title: 'Large Data Pipelines',
        status: 'pending',
        duration: '2-3 weeks',
        complexity: 'critical',
        target: 'Sharding, incremental ingestion, ETL'
      },
      {
        id: 'p3-analytics',
        title: 'Advanced Graph Analytics',
        status: 'pending',
        duration: '2 weeks',
        complexity: 'high',
        target: 'PageRank, community detection, centrality'
      }
    ]
  },
  {
    id: 4,
    name: 'Future Innovations',
    goal: 'Next-generation knowledge exploration',
    duration: 'Ongoing R&D',
    status: 'pending',
    completion: 0,
    tasks: [
      {
        id: 'p4-ai-layout',
        title: 'AI-Assisted Layout',
        status: 'pending',
        duration: 'TBD',
        complexity: 'high',
        target: 'ML-powered auto-arrangement'
      },
      {
        id: 'p4-arvr',
        title: 'AR/VR Immersive Clients',
        status: 'pending',
        duration: 'TBD',
        complexity: 'critical',
        target: 'Spatial computing for knowledge'
      },
      {
        id: 'p4-webgpu',
        title: 'WebGPU Migration',
        status: 'pending',
        duration: 'TBD',
        complexity: 'critical',
        target: '10x performance leap (2026)'
      },
      {
        id: 'p4-nlp',
        title: 'Natural Language Queries',
        status: 'pending',
        duration: 'TBD',
        complexity: 'high',
        target: 'Conversational graph exploration'
      }
    ]
  }
];

const StatusBadge: React.FC<{ status: Task['status'] }> = ({ status }) => {
  const styles = {
    completed: 'bg-green-500/20 text-green-400 border-green-500/50',
    in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    blocked: 'bg-red-500/20 text-red-400 border-red-500/50'
  };

  const labels = {
    completed: '✓ Complete',
    in_progress: '⚡ In Progress',
    pending: '○ Pending',
    blocked: '⚠ Blocked'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

const ComplexityBadge: React.FC<{ complexity: Task['complexity'] }> = ({ complexity }) => {
  const styles = {
    low: 'bg-blue-500/20 text-blue-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-orange-500/20 text-orange-400',
    critical: 'bg-red-500/20 text-red-400'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs ${styles[complexity]}`}>
      {complexity.toUpperCase()}
    </span>
  );
};

const ProgressBar: React.FC<{ percentage: number; className?: string }> = ({ percentage, className = '' }) => (
  <div className={`h-2 bg-gray-800 rounded-full overflow-hidden ${className}`}>
    <div 
      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
      style={{ width: `${percentage}%` }}
    />
  </div>
);

export const ProjectRoadmap: React.FC = () => {
  const totalTasks = ROADMAP_DATA.reduce((acc, phase) => acc + phase.tasks.length, 0);
  const completedTasks = ROADMAP_DATA.reduce(
    (acc, phase) => acc + phase.tasks.filter(t => t.status === 'completed').length,
    0
  );
  const overallProgress = (completedTasks / totalTasks) * 100;

  return (
    <div className="min-h-screen bg-black text-white p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-2">
            Glyph Foundry Roadmap
          </h1>
          <p className="text-gray-400 text-sm">
            Building Google Earth-level performance for knowledge visualization
          </p>
        </div>

        {/* Overall Progress */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-cyan-400">Overall Progress</h2>
            <span className="text-2xl font-bold text-white">{overallProgress.toFixed(1)}%</span>
          </div>
          <ProgressBar percentage={overallProgress} className="h-3" />
          <div className="mt-4 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-cyan-400">{completedTasks}</div>
              <div className="text-xs text-gray-400">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {ROADMAP_DATA.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'in_progress').length, 0)}
              </div>
              <div className="text-xs text-gray-400">In Progress</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">
                {ROADMAP_DATA.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'pending').length, 0)}
              </div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalTasks}</div>
              <div className="text-xs text-gray-400">Total Tasks</div>
            </div>
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-6">
          {ROADMAP_DATA.map((phase) => (
            <div
              key={phase.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                phase.status === 'in_progress'
                  ? 'border-cyan-500/50 bg-cyan-500/5'
                  : phase.status === 'completed'
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-gray-700 bg-gray-900/50'
              }`}
            >
              {/* Phase Header */}
              <div className="p-6 border-b border-gray-800">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      Phase {phase.id}: {phase.name}
                    </h3>
                    <p className="text-sm text-gray-400">{phase.goal}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={phase.status} />
                    <div className="text-xs text-gray-500 mt-2">{phase.duration}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ProgressBar percentage={phase.completion} className="flex-1" />
                  <span className="text-sm text-gray-400 font-mono">{phase.completion.toFixed(0)}%</span>
                </div>
              </div>

              {/* Tasks */}
              <div className="p-6 space-y-4">
                {phase.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-4 transition-all ${
                      task.status === 'completed'
                        ? 'border-green-500/30 bg-green-500/5'
                        : task.status === 'in_progress'
                        ? 'border-cyan-500/30 bg-cyan-500/5'
                        : 'border-gray-800 bg-black/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white mb-1">{task.title}</h4>
                        {task.target && (
                          <p className="text-sm text-gray-400 mb-2">🎯 {task.target}</p>
                        )}
                        {task.mobileImpact && (
                          <p className="text-sm text-purple-400">📱 {task.mobileImpact}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={task.status} />
                        <ComplexityBadge complexity={task.complexity} />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>⏱ {task.duration}</span>
                      {task.dependencies && task.dependencies.length > 0 && (
                        <span>🔗 Depends on: {task.dependencies.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Timeline Footer */}
        <div className="mt-8 p-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg">
          <h3 className="text-xl font-bold text-white mb-4">Timeline to Enterprise-Ready</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">5-7w</div>
              <div className="text-xs text-gray-400">Phase 1</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">4-6w</div>
              <div className="text-xs text-gray-400">Phase 2</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-400">6-8w</div>
              <div className="text-xs text-gray-400">Phase 3</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">4-5mo</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
