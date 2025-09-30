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
  tags?: {
    total: number;
  };
  status: string;
  version: string;
}

export function Dashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const overviewData = await request<OverviewResponse>("/api/v1/overview");
        setOverview(overviewData);
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
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Overview</h1>
        <p className="text-base text-gray-600">
          Monitor your knowledge graph health and system status.
        </p>
      </header>

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

      {overview && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Total Connections</span>
              <span className="text-2xl font-bold text-gray-900">{overview.edges.total}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">System Status</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-sm font-medium text-gray-900 capitalize">{overview.status}</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Version</span>
              <span className="text-sm font-mono text-gray-900">{overview.version}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
  icon: React.ReactNode;
}

function StatCard({ label, value, tone, icon }: StatCardProps) {
  const toneColors = {
    success: "text-green-600 bg-green-50 border-green-200",
    warning: "text-amber-600 bg-amber-50 border-amber-200",
    danger: "text-red-600 bg-red-50 border-red-200",
  };

  const iconColors = {
    success: "text-green-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  };

  return (
    <div className={`rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow ${tone ? toneColors[tone] : "border-gray-200"}`}>
      <div className="flex items-center justify-between mb-3">
        <dt className="text-sm font-medium text-gray-600">{label}</dt>
        <div className={tone ? iconColors[tone] : "text-gray-400"}>
          {icon}
        </div>
      </div>
      <dd className="text-3xl font-bold text-gray-900">{value}</dd>
    </div>
  );
}
