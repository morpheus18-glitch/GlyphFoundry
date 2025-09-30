import { useState, useEffect } from 'react';

interface CollectorStats {
  total_metrics_collected: number;
  glyphs_generated: number;
  collection_rate_per_second: number;
  active_collectors: number;
  protocols_enabled: string[];
  uptime_seconds: number;
}

interface GlyphStats {
  total_glyphs: number;
  glyphs_by_type: Record<string, number>;
  time_range: {
    earliest: string;
    latest: string;
  };
  spatial_distribution: {
    clusters: number;
    avg_cluster_size: number;
  };
}

export function AdminDashboard() {
  const [collectorStats, setCollectorStats] = useState<CollectorStats | null>(null);
  const [glyphStats, setGlyphStats] = useState<GlyphStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const [metricsRes, glyphsRes] = await Promise.all([
        fetch('/api/admin/metrics/stats'),
        fetch('/api/admin/glyphs/stats')
      ]);
      
      const metrics = await metricsRes.json();
      const glyphs = await glyphsRes.json();
      
      setCollectorStats(metrics);
      setGlyphStats(glyphs);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-cyan-400 text-xl">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-cyan-400">
          🔮 Glyph Foundry Admin Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Metrics"
            value={collectorStats?.total_metrics_collected.toLocaleString() || '0'}
            icon="📊"
            color="cyan"
          />
          <StatCard
            title="Glyphs Generated"
            value={glyphStats?.total_glyphs.toLocaleString() || '0'}
            icon="✨"
            color="purple"
          />
          <StatCard
            title="Collection Rate"
            value={`${collectorStats?.collection_rate_per_second.toFixed(1) || '0'}/s`}
            icon="⚡"
            color="yellow"
          />
          <StatCard
            title="Active Collectors"
            value={collectorStats?.active_collectors.toString() || '0'}
            icon="🤖"
            color="green"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-cyan-500/30">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400">Metrics Collection</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Uptime:</span>
                <span className="text-white font-mono">
                  {formatUptime(collectorStats?.uptime_seconds || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Protocols:</span>
                <div className="flex gap-2">
                  {collectorStats?.protocols_enabled.map(protocol => (
                    <span
                      key={protocol}
                      className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm"
                    >
                      {protocol}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold mb-4 text-purple-400">4D Glyph Statistics</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Spatial Clusters:</span>
                <span className="text-white font-mono">
                  {glyphStats?.spatial_distribution.clusters}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg Cluster Size:</span>
                <span className="text-white font-mono">
                  {glyphStats?.spatial_distribution.avg_cluster_size}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Time Range:</span>
                <span className="text-white text-sm font-mono">
                  {formatTime(glyphStats?.time_range.earliest || '')} - {formatTime(glyphStats?.time_range.latest || '')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-yellow-500/30">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400">Glyphs by Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(glyphStats?.glyphs_by_type || {}).map(([type, count]) => (
              <div key={type} className="bg-gray-700/50 rounded p-4">
                <div className="text-gray-400 text-sm mb-1">{formatTypeName(type)}</div>
                <div className="text-2xl font-bold text-white">{count.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'cyan' | 'purple' | 'yellow' | 'green';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    cyan: 'border-cyan-500/30 text-cyan-400',
    purple: 'border-purple-500/30 text-purple-400',
    yellow: 'border-yellow-500/30 text-yellow-400',
    green: 'border-green-500/30 text-green-400',
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-6 border ${colorClasses[color]}`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-gray-400 text-sm mb-1">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString();
}

function formatTypeName(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
