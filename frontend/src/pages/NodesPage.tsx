import { FormEvent, useEffect, useState } from "react";
import { request } from "../api/client";

interface Node {
  id: number;
  name: string;
  status: string;
  healthy: boolean;
  cpu_usage: number;
  memory_usage: number;
  last_heartbeat: string;
}

export function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadNodes() {
    try {
      setError(null);
      const response = await request<Node[]>("/api/v1/nodes");
      setNodes(response);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    loadNodes();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await request<Node>("/api/v1/nodes", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      await loadNodes();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Node Registry</h1>
          <p className="text-sm text-neutral-500">Track distributed worker nodes and register new ones.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Worker name"
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            required
          />
          <button
            type="submit"
            className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400"
          >
            Register
          </button>
        </form>
      </header>
      {error && <div className="rounded border border-red-400 bg-red-950/40 p-3 text-red-200">{error}</div>}
      <div className="overflow-x-auto rounded border border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-800 text-sm">
          <thead className="bg-neutral-950/60 text-neutral-400">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">CPU</th>
              <th className="px-4 py-2 text-right">Memory</th>
              <th className="px-4 py-2 text-left">Heartbeat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-neutral-900/40">
                <td className="px-4 py-2 font-medium text-neutral-100">{node.name}</td>
                <td className="px-4 py-2">
                  <StatusPill status={node.status} healthy={node.healthy} />
                </td>
                <td className="px-4 py-2 text-right text-neutral-300">{node.cpu_usage.toFixed(1)}%</td>
                <td className="px-4 py-2 text-right text-neutral-300">{node.memory_usage.toFixed(1)}%</td>
                <td className="px-4 py-2 text-neutral-400">
                  {new Date(node.last_heartbeat).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusPill({ status, healthy }: { status: string; healthy: boolean }) {
  const tone = healthy ? "bg-emerald-900/40 text-emerald-200" : status === "degraded" ? "bg-amber-900/40 text-amber-200" : "bg-red-900/40 text-red-200";
  return <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${tone}`}>{status}</span>;
}
