import React from 'react';
import { X } from 'lucide-react';

interface NodeData {
  id: string;
  name: string;
  summary?: string;
  content?: string;
  tags?: string[];
  connections?: Array<{ id: string; name: string; weight?: number }>;
  metadata?: {
    duration?: number;
    messageCount?: number;
    participantCount?: number;
  };
}

interface FocusedNodeViewProps {
  node: NodeData;
  onClose: () => void;
}

export const FocusedNodeView: React.FC<FocusedNodeViewProps> = ({ node, onClose }) => {
  const contentLines = node.content?.split('\n').filter(line => line.trim()) || [];
  const summaryLines = node.summary?.split('\n').filter(line => line.trim()) || [];
  
  const relatedNodes = node.connections?.slice(0, 5) || [];
  const tags = node.tags?.slice(0, 6) || [];

  return (
    <div className="absolute inset-0 z-40">
      {/* Click-outside backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close focused view"
      />
      
      <div className="relative h-full w-full flex items-center justify-center pointer-events-none">
        
        {/* Top Panel - Node Content */}
        <div className="absolute top-8 md:top-16 left-1/2 -translate-x-1/2 w-[90%] md:w-[600px] pointer-events-auto">
          <div 
            className="backdrop-blur-xl bg-black/40 border border-cyan-400/50 rounded-2xl p-4 md:p-6 shadow-2xl"
            style={{
              boxShadow: '0 0 40px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1)'
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors group"
              aria-label="Close focused view"
            >
              <X className="w-5 h-5 text-gray-400 group-hover:text-cyan-400" />
            </button>

            <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3 uppercase tracking-wide">
              {node.name || 'Conversation'}
            </h2>
            
            {summaryLines.length > 0 && (
              <div className="mb-3 text-cyan-300/80 text-sm md:text-base italic">
                {summaryLines[0]}
              </div>
            )}

            <div className="space-y-2">
              {contentLines.slice(0, 4).map((line, idx) => (
                <div key={idx} className="flex items-start gap-2 text-gray-300 text-sm md:text-base">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>

            {/* Metrics */}
            {node.metadata && (
              <div className="mt-4 pt-4 border-t border-cyan-400/20 flex items-center gap-6 text-xs md:text-sm">
                {node.metadata.duration !== undefined && (
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider">Duration</span>
                    <span className="ml-2 text-cyan-400 font-bold">{node.metadata.duration} min</span>
                  </div>
                )}
                {node.metadata.messageCount !== undefined && (
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider">Messages</span>
                    <span className="ml-2 text-cyan-400 font-bold">{node.metadata.messageCount}</span>
                  </div>
                )}
                {node.metadata.participantCount !== undefined && (
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider">Participants</span>
                    <span className="ml-2 text-cyan-400 font-bold">{node.metadata.participantCount}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Left Panel - Smart Tags */}
        {tags.length > 0 && (
          <div className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 w-[180px] md:w-[240px] pointer-events-auto">
            <div 
              className="backdrop-blur-xl bg-black/40 border border-cyan-400/50 rounded-2xl p-4 shadow-2xl"
              style={{
                boxShadow: '0 0 30px rgba(6, 182, 212, 0.2), inset 0 0 15px rgba(6, 182, 212, 0.1)'
              }}
            >
              <h3 className="text-xs md:text-sm font-bold text-cyan-400 mb-3 uppercase tracking-wider">
                Smart Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <button
                    key={idx}
                    className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 
                             rounded-lg text-xs md:text-sm text-cyan-300 font-medium uppercase tracking-wide
                             transition-all hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right Panel - Related Nodes */}
        {relatedNodes.length > 0 && (
          <div className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 w-[200px] md:w-[280px] pointer-events-auto">
            <div 
              className="backdrop-blur-xl bg-black/40 border border-cyan-400/50 rounded-2xl p-4 shadow-2xl"
              style={{
                boxShadow: '0 0 30px rgba(6, 182, 212, 0.2), inset 0 0 15px rgba(6, 182, 212, 0.1)'
              }}
            >
              <h3 className="text-xs md:text-sm font-bold text-cyan-400 mb-3 uppercase tracking-wider">
                Related Nodes
              </h3>
              <div className="space-y-2">
                {relatedNodes.map((related, idx) => (
                  <button
                    key={idx}
                    className="w-full text-left px-3 py-2 bg-white/5 hover:bg-cyan-500/20 
                             border border-cyan-400/20 hover:border-cyan-400/40 rounded-lg
                             transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span className="text-gray-300 text-sm group-hover:text-cyan-300 transition-colors">
                        {related.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Center glow effect placeholder - actual node will be visible behind this */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div 
            className="w-64 h-64 md:w-96 md:h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
