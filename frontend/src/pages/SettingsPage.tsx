import { FormEvent, useEffect, useState } from "react";
import { request } from "../api/client";

interface SettingEntry {
  id: number;
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [form, setForm] = useState({ key: "", value: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    try {
      setError(null);
      const response = await request<SettingEntry[]>("/api/v1/settings");
      setSettings(response);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await request<SettingEntry>("/api/v1/settings", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ key: "", value: "", description: "" });
      await loadSettings();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Configuration</h1>
        <p className="text-sm text-neutral-500">Persist feature flags and operational parameters.</p>
      </header>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:items-end">
        <label className="space-y-1 text-sm">
          <span className="text-neutral-400">Key</span>
          <input
            value={form.key}
            onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-neutral-400">Value</span>
          <input
            value={form.value}
            onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            required
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-neutral-400">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            className="h-16 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </label>
        <button
          type="submit"
          className="sm:col-span-2 rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400"
        >
          Save setting
        </button>
      </form>
      {error && <div className="rounded border border-red-400 bg-red-950/40 p-3 text-red-200">{error}</div>}
      <div className="overflow-x-auto rounded border border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-800 text-sm">
          <thead className="bg-neutral-950/60 text-neutral-400">
            <tr>
              <th className="px-4 py-2 text-left">Key</th>
              <th className="px-4 py-2 text-left">Value</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {settings.map((entry) => (
              <tr key={entry.id} className="hover:bg-neutral-900/40">
                <td className="px-4 py-2 font-medium text-neutral-100">{entry.key}</td>
                <td className="px-4 py-2 text-neutral-300">{entry.value}</td>
                <td className="px-4 py-2 text-neutral-400">{entry.description || "—"}</td>
                <td className="px-4 py-2 text-neutral-400">{new Date(entry.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
