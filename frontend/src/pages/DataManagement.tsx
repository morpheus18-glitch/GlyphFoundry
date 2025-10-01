import React, { useState, useEffect, useCallback } from 'react';

type Node = {
  id: string;
  kind: string;
  name: string | null;
  summary: string | null;
  content: string | null;
  color: string;
  size: number;
  created_at: string;
};

type FileUpload = {
  id: string;
  filename: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  processing_status: string;
  node_id: string | null;
  created_at: string;
};

const API_BASE = '/api/v1/knowledge';
const FILES_API = '/files';
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000000'; // Default Tenant UUID

interface DataManagementProps {
  onNodeSelect?: (nodeId: string) => void;
}

export function DataManagement({ onNodeSelect }: DataManagementProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'upload' | 'browse'>('browse');
  
  const [newNode, setNewNode] = useState({
    kind: 'message',
    name: '',
    summary: '',
    content: '',
    color: '#4A90E2',
    size: 1.0,
    glow_intensity: 0.5
  });
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');

  const loadNodes = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/tenants/${DEFAULT_TENANT}/graph?limit_nodes=100&limit_edges=0&window_minutes=525600`);
      if (response.ok) {
        const data = await response.json();
        setNodes(data.nodes || []);
      }
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const response = await fetch(`${FILES_API}/list?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }, []);

  useEffect(() => {
    loadNodes();
    loadFiles();
  }, [loadNodes, loadFiles]);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/tenants/${DEFAULT_TENANT}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNode)
      });
      
      if (response.ok) {
        const created = await response.json();
        setNodes(prev => [created, ...prev]);
        setNewNode({
          kind: 'message',
          name: '',
          summary: '',
          content: '',
          color: '#4A90E2',
          size: 1.0,
          glow_intensity: 0.5
        });
        setActiveTab('browse');
      } else {
        alert('Failed to create node');
      }
    } catch (error) {
      console.error('Error creating node:', error);
      alert('Error creating node');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadDescription) {
        formData.append('description', uploadDescription);
      }
      
      const response = await fetch(`${FILES_API}/upload`, {
        method: 'POST',
        headers: {
          'X-Tenant-ID': DEFAULT_TENANT
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setFiles(prev => [result.file_metadata, ...prev]);
        setUploadFile(null);
        setUploadDescription('');
        setActiveTab('browse');
        loadNodes();
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#050508] to-black text-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-fuchsia-300 tracking-wider mb-2">
            Knowledge Management
          </h1>
          <p className="text-cyan-500/60 text-sm uppercase tracking-wider">
            Upload files, create nodes, and manage your knowledge graph
          </p>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${
              activeTab === 'browse'
                ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 text-white shadow-2xl shadow-cyan-500/50'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300 border border-cyan-500/20'
            }`}
          >
            Browse Data
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 text-white shadow-2xl shadow-cyan-500/50'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300 border border-cyan-500/20'
            }`}
          >
            Create Node
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${
              activeTab === 'upload'
                ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 text-white shadow-2xl shadow-cyan-500/50'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-300 border border-cyan-500/20'
            }`}
          >
            Upload Files
          </button>
        </div>

        {activeTab === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-black/95 via-cyan-950/20 to-black/90 backdrop-blur-xl p-6">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50"></span>
                Nodes ({nodes.length})
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {nodes.length === 0 && (
                  <p className="text-cyan-500/50 text-sm">No nodes yet. Create one to get started!</p>
                )}
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    className="w-full text-left p-4 rounded-xl bg-black/40 border border-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-4 h-4 rounded-full mt-1 shrink-0 shadow-lg"
                        style={{ backgroundColor: node.color, boxShadow: `0 0 20px ${node.color}` }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-cyan-100 font-semibold truncate group-hover:text-cyan-300">
                          {node.name || `Node ${node.id.slice(0, 8)}`}
                        </h3>
                        {node.summary && (
                          <p className="text-cyan-500/70 text-sm mt-1 line-clamp-2">{node.summary}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-cyan-500/50">
                          <span className="uppercase tracking-wider">{node.kind}</span>
                          <span>•</span>
                          <span>{new Date(node.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-black/95 via-purple-950/20 to-black/90 backdrop-blur-xl p-6">
              <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50"></span>
                Files ({files.length})
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {files.length === 0 && (
                  <p className="text-purple-500/50 text-sm">No files uploaded yet.</p>
                )}
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => file.node_id && handleNodeClick(file.node_id)}
                    className={`w-full text-left p-4 rounded-xl bg-black/40 border border-purple-500/10 transition-all ${
                      file.node_id ? 'hover:border-purple-400/50 hover:bg-purple-500/10 cursor-pointer group' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-purple-100 font-semibold truncate group-hover:text-purple-300">{file.filename}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-purple-500/70">
                          <span className="uppercase tracking-wider">{file.file_type}</span>
                          <span>•</span>
                          <span>{(file.size_bytes / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{new Date(file.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                            file.processing_status === 'processed' 
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                              : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          }`}>
                            {file.processing_status}
                          </span>
                          {file.node_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              Linked
                            </span>
                          )}
                        </div>
                      </div>
                      {file.node_id && (
                        <svg className="w-5 h-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-black/95 via-cyan-950/20 to-black/90 backdrop-blur-xl p-8 max-w-3xl">
            <h2 className="text-2xl font-bold text-cyan-300 mb-6">Create New Node</h2>
            <form onSubmit={handleCreateNode} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-cyan-400 mb-2 uppercase tracking-wider">
                  Node Type
                </label>
                <select
                  value={newNode.kind}
                  onChange={(e) => setNewNode({ ...newNode, kind: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/30 text-cyan-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="message">Message</option>
                  <option value="document">Document</option>
                  <option value="concept">Concept</option>
                  <option value="entity">Entity</option>
                  <option value="event">Event</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-cyan-400 mb-2 uppercase tracking-wider">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={newNode.name}
                  onChange={(e) => setNewNode({ ...newNode, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/30 text-cyan-100 placeholder:text-cyan-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="Enter node name..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-cyan-400 mb-2 uppercase tracking-wider">
                  Summary
                </label>
                <input
                  type="text"
                  value={newNode.summary}
                  onChange={(e) => setNewNode({ ...newNode, summary: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/30 text-cyan-100 placeholder:text-cyan-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="Brief summary..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-cyan-400 mb-2 uppercase tracking-wider">
                  Content *
                </label>
                <textarea
                  required
                  value={newNode.content}
                  onChange={(e) => setNewNode({ ...newNode, content: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/30 text-cyan-100 placeholder:text-cyan-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="Enter detailed content..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-cyan-400 mb-2 uppercase tracking-wider">
                    Color
                  </label>
                  <input
                    type="color"
                    value={newNode.color}
                    onChange={(e) => setNewNode({ ...newNode, color: e.target.value })}
                    className="w-full h-12 rounded-xl bg-black/60 border border-cyan-500/30 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-cyan-400 mb-2 uppercase tracking-wider">
                    Size: {newNode.size.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={newNode.size}
                    onChange={(e) => setNewNode({ ...newNode, size: parseFloat(e.target.value) })}
                    className="w-full h-12 rounded-xl"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 text-white font-bold uppercase tracking-wider shadow-2xl shadow-cyan-500/50 hover:shadow-cyan-500/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Node'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-black/95 via-purple-950/20 to-black/90 backdrop-blur-xl p-8 max-w-3xl">
            <h2 className="text-2xl font-bold text-purple-300 mb-6">Upload Files</h2>
            <form onSubmit={handleFileUpload} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-purple-400 mb-2 uppercase tracking-wider">
                  Select File *
                </label>
                <div className="relative">
                  <input
                    type="file"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-purple-500/30 text-purple-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <p className="mt-2 text-xs text-purple-500/60">
                  Supports: Images, Documents (PDF, Word), CSV, JSON, Text, Video, Audio
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-purple-400 mb-2 uppercase tracking-wider">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-purple-500/30 text-purple-100 placeholder:text-purple-700 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="Add a description for this file..."
                />
              </div>

              <button
                type="submit"
                disabled={loading || !uploadFile}
                className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white font-bold uppercase tracking-wider shadow-2xl shadow-purple-500/50 hover:shadow-purple-500/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload File'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
