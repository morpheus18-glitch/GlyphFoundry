import { useEffect, useState } from "react";
import { request } from "../api/client";

interface NodeHealthSummary {
  total_nodes: number;
  healthy_nodes: number;
  degraded_nodes: number;
  unhealthy_nodes: number;
}

interface TelemetrySnapshot {
  generated_at: string;
  metrics: Record<string, { type: string; documentation: string; samples: any[] }>;
}

export function Dashboard() {
  const [summary, setSummary] = useState<NodeHealthSummary | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const [overview, telemetrySnapshot] = await Promise.all([
          request<NodeHealthSummary>("/api/v1/overview"),
          request<TelemetrySnapshot>("/api/v1/telemetry"),
        ]);
        setSummary(overview);
        setTelemetry(telemetrySnapshot);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    load();
  }, []);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Operational Overview</h1>
          <p className="text-sm text-neutral-500">
            Monitor node health and streaming telemetry emitted by the backend service.
          </p>
        </div>
      </header>
      {error && <div className="rounded border border-red-400 bg-red-950/40 p-3 text-red-200">{error}</div>}
      {summary && (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Nodes" value={summary.total_nodes} />
          <StatCard label="Healthy" value={summary.healthy_nodes} tone="success" />
          <StatCard label="Degraded" value={summary.degraded_nodes} tone="warning" />
          <StatCard label="Unhealthy" value={summary.unhealthy_nodes} tone="danger" />
        </dl>
      )}
      {telemetry && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Prometheus Metrics</h2>
          <div className="rounded border border-neutral-800 bg-neutral-950/60">
            <pre className="overflow-auto p-4 text-xs text-neutral-300">
              {JSON.stringify(telemetry.metrics, null, 2)}
            </pre>
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
}

function StatCard({ label, value, tone = "default" }: StatCardProps) {
  const palette: Record<typeof tone, string> = {
    default: "bg-neutral-900 text-neutral-100 border-neutral-800",
    success: "bg-emerald-900/40 text-emerald-200 border-emerald-500/40",
    warning: "bg-amber-900/40 text-amber-200 border-amber-500/40",
    danger: "bg-red-900/40 text-red-200 border-red-500/40",
  } as const;
  return (
    <div className={`rounded border p-4 ${palette[tone]}`}>
      <dt className="text-sm uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
