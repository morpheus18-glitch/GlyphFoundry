import React, { useState } from "react";
import { X, Edit2, Tag, Clock, Link2, ChevronDown, ChevronRight } from "lucide-react";

type NodeData = {
  id: string;
  label?: string;
  summary?: string;
  kind?: string;
  degree?: number;
  importance?: number;
  ts?: number;
  content?: string;
  tags?: string[];
  metadata?: Record<string, any>;
};

type Connection = {
  id: string;
  label: string;
  relationship: string;
};

export function NodeDetailPanel({
  node,
  connections = [],
  onClose,
  onEdit,
  onConnectionClick,
}: {
  node: NodeData;
  connections?: Connection[];
  onClose: () => void;
  onEdit?: (node: NodeData) => void;
  onConnectionClick?: (nodeId: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["overview", "connections"])
  );

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "Unknown";
    const date = new Date(ts * 1000);
    return date.toLocaleString();
  };

  return (
    <div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#0f0a08] to-[#0a0a0a] shadow-2xl backdrop-blur-xl md:w-[600px]">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(180,90,50,0.03)] to-transparent pointer-events-none" />
      
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between border-b border-[rgba(180,90,50,0.15)] bg-gradient-to-r from-[rgba(20,10,8,0.9)] to-[rgba(10,10,10,0.9)] px-6 py-5 backdrop-blur-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-br from-[#ff7f50] to-[#d2691e] shadow-lg shadow-[rgba(255,127,80,0.4)]" />
              <h2 className="truncate text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ffa07a] via-[#ff8c69] to-[#ff7f50]">
                {node.label || node.id}
              </h2>
            </div>
            {node.summary && (
              <p className="text-sm text-neutral-400 italic ml-6">{node.summary}</p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            {onEdit && (
              <button
                onClick={() => onEdit(node)}
                className="rounded-lg border border-[rgba(180,90,50,0.2)] bg-[rgba(30,15,10,0.8)] p-2 text-[#ff7f50] transition hover:bg-[rgba(40,20,15,0.9)] hover:border-[rgba(180,90,50,0.4)]"
                title="Edit node"
              >
                <Edit2 size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-[rgba(180,90,50,0.2)] bg-[rgba(30,15,10,0.8)] p-2 text-neutral-400 transition hover:bg-[rgba(40,20,15,0.9)] hover:text-[#ff7f50] hover:border-[rgba(180,90,50,0.4)]"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-track-[rgba(10,10,10,0.5)] scrollbar-thumb-[rgba(180,90,50,0.3)]">
          <Section
            title="Overview"
            icon={<Tag size={16} />}
            expanded={expandedSections.has("overview")}
            onToggle={() => toggleSection("overview")}
          >
            <div className="space-y-3">
              <InfoRow label="ID" value={node.id} />
              {node.kind && <InfoRow label="Type" value={node.kind} />}
              {typeof node.degree === "number" && (
                <InfoRow label="Connections" value={node.degree.toString()} />
              )}
              {typeof node.importance === "number" && (
                <InfoRow 
                  label="Importance" 
                  value={
                    <div className="flex items-center gap-2">
                      <span>{node.importance.toFixed(2)}</span>
                      <div className="h-2 w-32 rounded-full bg-[rgba(20,20,20,0.8)] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#ff7f50] to-[#ff4500]"
                          style={{ width: `${node.importance * 100}%` }}
                        />
                      </div>
                    </div>
                  }
                />
              )}
              {node.ts && (
                <InfoRow label="Created" value={formatTimestamp(node.ts)} icon={<Clock size={14} />} />
              )}
            </div>
          </Section>

          {node.content && (
            <Section
              title="Content"
              expanded={expandedSections.has("content")}
              onToggle={() => toggleSection("content")}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {node.content}
                </p>
              </div>
            </Section>
          )}

          {node.tags && node.tags.length > 0 && (
            <Section
              title="Tags"
              icon={<Tag size={16} />}
              expanded={expandedSections.has("tags")}
              onToggle={() => toggleSection("tags")}
            >
              <div className="flex flex-wrap gap-2">
                {node.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[rgba(180,90,50,0.3)] bg-gradient-to-r from-[rgba(40,20,15,0.6)] to-[rgba(30,15,10,0.6)] px-3 py-1 text-xs text-[#ffa07a]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {connections.length > 0 && (
            <Section
              title={`Connected Nodes (${connections.length})`}
              icon={<Link2 size={16} />}
              expanded={expandedSections.has("connections")}
              onToggle={() => toggleSection("connections")}
            >
              <div className="space-y-2">
                {connections.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => onConnectionClick?.(conn.id)}
                    className="group flex w-full items-start gap-3 rounded-lg border border-[rgba(180,90,50,0.15)] bg-gradient-to-r from-[rgba(25,12,8,0.6)] to-[rgba(20,10,8,0.6)] p-3 text-left transition hover:border-[rgba(180,90,50,0.4)] hover:from-[rgba(35,17,12,0.8)] hover:to-[rgba(30,15,10,0.8)]"
                  >
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-[#ff7f50] to-[#d2691e] shadow-lg shadow-[rgba(255,127,80,0.3)] group-hover:shadow-[rgba(255,127,80,0.6)]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#ffa07a] group-hover:text-[#ff8c69]">
                        {conn.label}
                      </div>
                      <div className="text-xs text-neutral-500 italic mt-0.5">
                        {conn.relationship}
                      </div>
                    </div>
                    <div className="text-neutral-600 group-hover:text-[#ff7f50]">→</div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {node.metadata && Object.keys(node.metadata).length > 0 && (
            <Section
              title="Metadata"
              expanded={expandedSections.has("metadata")}
              onToggle={() => toggleSection("metadata")}
            >
              <div className="space-y-2">
                {Object.entries(node.metadata).map(([key, value]) => (
                  <InfoRow
                    key={key}
                    label={key}
                    value={typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="border-t border-[rgba(180,90,50,0.15)] bg-gradient-to-r from-[rgba(20,10,8,0.9)] to-[rgba(10,10,10,0.9)] px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Node #{node.id.slice(0, 8)}...</span>
            <span>Deep black with rust HDR</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[rgba(180,90,50,0.15)] bg-gradient-to-br from-[rgba(20,10,8,0.4)] to-[rgba(15,10,8,0.4)] overflow-hidden backdrop-blur-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[rgba(30,15,10,0.6)]"
      >
        {expanded ? <ChevronDown size={16} className="text-[#ff7f50]" /> : <ChevronRight size={16} className="text-neutral-500" />}
        {icon && <span className="text-[#ff7f50]">{icon}</span>}
        <span className="flex-1 text-sm font-semibold text-[#ffa07a]">{title}</span>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex items-center gap-2 min-w-[120px] text-xs text-neutral-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 text-sm text-neutral-300 break-words">{value}</div>
    </div>
  );
}
