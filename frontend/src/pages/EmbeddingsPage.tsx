import { FormEvent, useState } from "react";
import { request } from "../api/client";

interface EmbeddingVector {
  content_hash: string;
  vector: number[];
  model_name: string;
  created_at: string;
}

interface EmbeddingResponse {
  embeddings_count: number;
  embeddings: EmbeddingVector[];
  model_name: string;
  quantum_enhanced: boolean;
}

export function EmbeddingsPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<EmbeddingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const texts = input
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      if (texts.length === 0) {
        throw new Error("Provide at least one text value");
      }
      const response = await request<EmbeddingResponse>("/api/v1/embeddings", {
        method: "POST",
        body: JSON.stringify({ texts }),
      });
      setResult(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Embedding Studio</h1>
        <p className="text-sm text-neutral-500">
          Submit text snippets to generate deterministic embeddings through the backend embedding service.
        </p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Enter one text per line"
          className="h-32 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />
        <button
          type="submit"
          className="rounded bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-400 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Generating…" : "Generate embeddings"}
        </button>
      </form>
      {error && <div className="rounded border border-red-400 bg-red-950/40 p-3 text-red-200">{error}</div>}
      {result && (
        <div className="space-y-3">
          <div className="rounded border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-300">
            <h2 className="mb-2 text-lg font-semibold text-neutral-100">Results</h2>
            <p className="text-neutral-400">
              Model: {result.model_name} • Embeddings: {result.embeddings_count} • Quantum enhanced: {result.quantum_enhanced ? "yes" : "no"}
            </p>
          </div>
          <div className="grid gap-3">
            {result.embeddings.map((embedding) => (
              <div key={embedding.content_hash} className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                <h3 className="text-sm font-semibold text-neutral-100">{embedding.content_hash.slice(0, 12)}…</h3>
                <p className="text-xs text-neutral-500">Created: {new Date(embedding.created_at).toLocaleString()}</p>
                <pre className="mt-2 max-h-40 overflow-auto text-xs text-neutral-300">
                  {JSON.stringify(embedding.vector.slice(0, 16), null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
