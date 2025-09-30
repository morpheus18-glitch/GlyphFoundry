import { useEffect, useState } from "react";
import { request } from "../api/client";

interface OverviewResponse {
  nodes: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
  };
  edges: {
    total: number;
  };
  status: string;
  version: string;
}

interface TelemetrySnapshot {
  generated_at: string;
  metrics: Record<string, { type: string; documentation: string; samples: any[] }>;
}

export function Dashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [overviewData, telemetrySnapshot] = await Promise.all([
          request<OverviewResponse>("/api/v1/overview"),
          request<TelemetrySnapshot>("/api/v1/telemetry"),
        ]);
        setOverview(overviewData);
        setTelemetry(telemetrySnapshot);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-base text-gray-600">
          Monitor your knowledge graph and system performance at a glance.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-medium text-red-900">Unable to load data</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {overview && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Graph Health</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              label="Total Nodes" 
              value={overview.nodes.total}
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              }
            />
            <StatCard 
              label="Healthy" 
              value={overview.nodes.healthy} 
              tone="success"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard 
              label="Degraded" 
              value={overview.nodes.degraded} 
              tone="warning"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
            <StatCard 
              label="Issues" 
              value={overview.nodes.failed} 
              tone="danger"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </dl>
        </div>
      )}

      {telemetry && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">System Metrics</h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Last updated:</span>{" "}
                {new Date(telemetry.generated_at).toLocaleString()}
              </p>
            </div>
            <div className="p-4">
              {Object.keys(telemetry.metrics).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">No metrics available</p>
                  <p className="text-xs text-gray-500 mt-1">System metrics will appear here once collected</p>
                </div>
              ) : (
                <pre className="overflow-auto text-xs font-mono text-gray-700 bg-gray-50 rounded-lg p-4">
                  {JSON.stringify(telemetry.metrics, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}

function StatCard({ label, value, tone = "default", icon }: StatCardProps) {
  const palette: Record<typeof tone, { bg: string; text: string; border: string; icon: string }> = {
    default: { 
      bg: "bg-white", 
      text: "text-gray-900", 
      border: "border-gray-200",
      icon: "text-gray-600"
    },
    success: { 
      bg: "bg-green-50", 
      text: "text-green-900", 
      border: "border-green-200",
      icon: "text-green-600"
    },
    warning: { 
      bg: "bg-amber-50", 
      text: "text-amber-900", 
      border: "border-amber-200",
      icon: "text-amber-600"
    },
    danger: { 
      bg: "bg-red-50", 
      text: "text-red-900", 
      border: "border-red-200",
      icon: "text-red-600"
    },
  } as const;
  
  const colors = palette[tone];
  
  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-6 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <dt className="text-sm font-medium text-gray-600">{label}</dt>
        {icon && (
          <div className={colors.icon}>
            {icon}
          </div>
        )}
      </div>
      <dd className={`text-3xl font-bold ${colors.text}`}>{value.toLocaleString()}</dd>
    </div>
  );
}
