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
    const interval = setInterval(fetchStats, 10000);
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
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-sm text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Administration</h1>
        <p className="text-base text-gray-600">
          Monitor system metrics and data collection status.
        </p>
      </header>

      {/* Metrics Collection Stats */}
      {collectorStats && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Metrics Collection</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Metrics"
              value={collectorStats.total_metrics_collected.toLocaleString()}
              color="blue"
            />
            <StatCard
              label="Data Points"
              value={collectorStats.glyphs_generated.toLocaleString()}
              color="green"
            />
            <StatCard
              label="Collection Rate"
              value={`${collectorStats.collection_rate_per_second.toFixed(1)}/s`}
              color="purple"
            />
            <StatCard
              label="Active Collectors"
              value={collectorStats.active_collectors.toString()}
              color="orange"
            />
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">System Uptime:</span>
              <span className="text-sm text-gray-900">{formatUptime(collectorStats.uptime_seconds)}</span>
            </div>
            {collectorStats.protocols_enabled.length > 0 && (
              <div className="mt-3 flex items-start gap-2">
                <span className="text-sm font-medium text-gray-700">Active Protocols:</span>
                <div className="flex flex-wrap gap-2">
                  {collectorStats.protocols_enabled.map((protocol) => (
                    <span
                      key={protocol}
                      className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                    >
                      {protocol}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Distribution Stats */}
      {glyphStats && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Distribution</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Data Points by Type</h3>
              {Object.keys(glyphStats.glyphs_by_type).length === 0 ? (
                <p className="text-sm text-gray-500">No data points yet</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(glyphStats.glyphs_by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{type}</span>
                      <span className="text-sm font-medium text-gray-900">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Spatial Analysis</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Total Clusters</span>
                  <span className="text-sm font-medium text-gray-900">
                    {glyphStats.spatial_distribution.clusters}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Avg. Cluster Size</span>
                  <span className="text-sm font-medium text-gray-900">
                    {glyphStats.spatial_distribution.avg_cluster_size.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {glyphStats.time_range.earliest && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Data Collection Period:</span>
                  <div className="mt-1 text-xs text-gray-600">
                    {new Date(glyphStats.time_range.earliest).toLocaleString()} 
                    {' → '}
                    {new Date(glyphStats.time_range.latest).toLocaleString()}
                  </div>
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  {glyphStats.total_glyphs.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <dt className="text-sm font-medium text-gray-600 mb-2">{label}</dt>
      <dd className={`text-3xl font-bold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
        {value}
      </dd>
    </div>
  );
}
