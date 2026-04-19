import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Network, MessageSquare, GitBranch, Activity, CheckCircle, Search, FileText, Compass, AlertTriangle, BookOpen } from 'lucide-react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/* ══════════════════════════════════════════════════════════════
   Graph Analysis Utilities
   ══════════════════════════════════════════════════════════════ */
const analyzeNodes = (nodes, edges) => {
  const inDegree = {};
  const outDegree = {};
  
  nodes.forEach(n => {
    inDegree[n] = 0;
    outDegree[n] = 0;
  });

  edges.forEach(e => {
    if (outDegree[e.from] !== undefined) outDegree[e.from]++;
    if (inDegree[e.to] !== undefined) inDegree[e.to]++;
  });

  const analysis = {};
  nodes.forEach(n => {
    const isEntry = inDegree[n] === 0 && outDegree[n] > 0;
    const isUtility = inDegree[n] > 0 && outDegree[n] === 0;
    const isCore = inDegree[n] > 0 && outDegree[n] > 0;
    const isOrphan = inDegree[n] === 0 && outDegree[n] === 0;

    const isMain = n.toLowerCase().includes('index') || n.toLowerCase().includes('main') || n.toLowerCase().includes('app');

    let type = 'unknown';
    if (isOrphan && !isMain) type = 'orphan';
    else if (isEntry || isMain) type = 'entry';
    else if (isUtility) type = 'utility';
    else if (isCore) type = 'core';

    analysis[n] = {
      type,
      inDegree: inDegree[n] || 0,
      outDegree: outDegree[n] || 0,
      dependents: edges.filter(e => e.to === n).map(e => e.from),
      dependencies: edges.filter(e => e.from === n).map(e => e.to)
    };
  });
  return analysis;
};

/* ══════════════════════════════════════════════════════════════
   Graph View Component
   ══════════════════════════════════════════════════════════════ */
const GraphViewInner = ({ data, searchQuery, onNodeClick, selectedNode, repoUrl }) => {
  const [nodeDetails, setNodeDetails] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Derive graph categories
  const graphAnalysis = useMemo(() => {
    if (!data?.dependencyGraph || !data.dependencyGraph.nodes) return {};
    return analyzeNodes(data.dependencyGraph.nodes, data.dependencyGraph.edges || []);
  }, [data]);

  // Hook for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 1. Initial Structural Load: Positions & Objects (Runs ONLY when Data changes)
  useEffect(() => {
    if (!data || !data.dependencyGraph) return;

    const validNodes = Array.isArray(data.dependencyGraph.nodes) ? data.dependencyGraph.nodes : [];
    const validEdgesRaw = Array.isArray(data.dependencyGraph.edges) ? data.dependencyGraph.edges : [];
    const validEdges = validEdgesRaw.filter(e => validNodes.includes(e.from) && validNodes.includes(e.to));

    const cols = Math.ceil(Math.sqrt(validNodes.length));
    const horizontalSpacing = 350;
    const verticalSpacing = 200;

    const initialNodes = validNodes.map((nodeId, idx) => {
      const xPos = (idx % cols) * horizontalSpacing;
      const yPos = Math.floor(idx / cols) * verticalSpacing;

      return {
        id: nodeId,
        position: { x: xPos, y: yPos },
        style: { animationDelay: (idx * 0.05) + 's' },
        className: "react-flow__node-custom", 
        data: { label: null } // Placeholder, built in pass 2
      };
    });

    const initialMappedEdges = validEdges.map((e, idx) => {
      return {
        id: "e-" + e.from + "-" + e.to + "-" + idx,
        source: e.from,
        target: e.to,
        animated: true,
        style: { strokeDasharray: "5 5", transition: "all 0.3s ease" }
      };
    });

    setNodes(initialNodes);
    setEdges(initialMappedEdges);
  }, [data, setNodes, setEdges]);

  // 2. Dynamic Update Pass: Visuals, Selections, Classes (Runs when interactions happen)
  useEffect(() => {
    if (!data || !data.dependencyGraph) return;

    setNodes(nds => nds.map(node => {
      const nodeId = node.id;
      const isHighImpact = data.highImpactFiles && data.highImpactFiles.some(h => h.file === nodeId);
      const isHighlighted = searchQuery && nodeId.toLowerCase().includes(searchQuery.toLowerCase());
      
      const validEdgesRaw = Array.isArray(data.dependencyGraph.edges) ? data.dependencyGraph.edges : [];
      const isConnectedToSelected = selectedNode && (validEdgesRaw.some(e => (e.from === selectedNode && e.to === nodeId) || (e.to === selectedNode && e.from === nodeId)));
      const isDimmed = selectedNode && selectedNode !== nodeId && !isConnectedToSelected;

      const analysis = graphAnalysis[nodeId] || {};
      
      let className = "react-flow__node-custom " + (analysis.type || "unknown");
      if (isHighImpact) className += " high-impact";
      if (isHighlighted) className += " highlighted";
      if (selectedNode === nodeId) className += " selected";
      if (isDimmed) className += " dimmed";

      return {
        ...node,
        className,
        data: { 
          ...node.data,
          label: (
            <div title={`${nodeId}\nRole: ${analysis.type}`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
              {nodeId.split('/').pop() || nodeId}
            </div>
          ) 
        }
      };
    }));

    setEdges(eds => eds.map(edge => {
      const isConnectedToSelected = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
      const isDimmedState = selectedNode && !isConnectedToSelected;
      
      return {
        ...edge,
        style: { 
          ...edge.style,
          stroke: isConnectedToSelected ? 'var(--accent)' : 'rgba(150, 150, 200, 0.5)', 
          opacity: isDimmedState ? 0.15 : 0.9, 
          strokeWidth: isConnectedToSelected ? 3 : 1.5
        }
      };
    }));
  }, [data, searchQuery, graphAnalysis, selectedNode, setNodes, setEdges]);

  // Fetch AI summary when node is clicked
  useEffect(() => {
    if (!selectedNode) {
      setNodeDetails(null);
      return;
    }
    const analysis = graphAnalysis[selectedNode] || { dependencies: [], dependents: [], type: 'unknown' };
    setNodeDetails({ ...analysis, summary: null });
    setLoadingSummary(true);

    axios.post('/api/explain', { 
      repoUrl,
      filename: selectedNode 
    })
    .then(res => {
      if (res.data.success) {
        setNodeDetails(prev => prev ? { ...prev, summary: res.data.data.summary || "No summary provided." } : prev);
      } else {
        setNodeDetails(prev => prev ? { ...prev, summary: res.data.error?.message || "AI Summary unavailable." } : prev);
      }
    })
    .catch((err) => {
      let errMsg = "AI Summary unavailable.";
      if (err.response && err.response.data && err.response.data.error) {
         errMsg = err.response.data.error.message;
      } else if (err.message) {
         errMsg = err.message;
      }
      setNodeDetails(prev => prev ? { ...prev, summary: "Error: " + errMsg } : prev);
    })
    .finally(() => setLoadingSummary(false));

  }, [selectedNode, repoUrl, graphAnalysis]);

  // Simple click: only open the side panel, no camera movement
  const handleNodeClick = (evt, node) => {
    onNodeClick(node.id);
  };

  return (
    <div className="view-container" style={{ display: 'flex', position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background variant={BackgroundVariant.Dots} color="#888" gap={20} size={1.2} />
        </ReactFlow>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 20, right: 30, background: 'rgba(20,20,22,0.95)', padding: '15px 20px', borderRadius: '12px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, animation: 'fadeInGraph 1s ease-out backwards', animationDelay: '0.5s' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Architecture Legend</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'var(--accent)', borderRadius:'50%', boxShadow: '0 0 10px var(--accent)' }}></div> Entry / Main</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'#10b981', borderRadius:'50%', boxShadow: '0 0 10px #10b981' }}></div> Utility</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'#a855f7', borderRadius:'50%', boxShadow: '0 0 10px #a855f7' }}></div> Core Logic</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'#ef4444', borderRadius:'50%', boxShadow: '0 0 10px #ef4444' }}></div> Orphan (Dead Code)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width:12, height:12, border:'2px solid #f59e0b', borderRadius:'50%', boxShadow: '0 0 10px #f59e0b' }}></div> High Impact</div>
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && nodeDetails && (
        <div style={{ width: '380px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Header */}
          <div style={{ padding: '20px 24px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', wordBreak: 'break-all', color: '#f8fafc', fontFamily: 'monospace' }}>{selectedNode}</h3>
              <button onClick={() => onNodeClick(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', outline: 'none' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <span className={"badge " + (nodeDetails.type || "unknown")}>{(nodeDetails.type || "unknown").toUpperCase()}</span>
              {data.highImpactFiles && data.highImpactFiles.some(h => h.file === selectedNode) && <span className="badge high-impact">High Impact</span>}
            </div>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Summary</h4>
              {loadingSummary ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--accent)', animation: 'pulse 1.5s infinite', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: 'var(--accent)' }}></div>
                  Analyzing role in codebase...
                </div>
              ) : (
                <div style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.6', color: '#cbd5e1', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span dangerouslySetInnerHTML={{ __html: nodeDetails.summary?.replace(/\n/g, '<br/>') || 'Summary missing.' }} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Imports <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{nodeDetails.dependencies ? nodeDetails.dependencies.length : 0}</span>
              </h4>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {nodeDetails.dependencies && nodeDetails.dependencies.slice(0, 8).map(d => (
                  <li key={d} style={{ fontSize: '0.85rem', color: '#64748b', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '4px', borderLeft: '2px solid #3b82f6', fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => onNodeClick(d)}>{d}</li>
                ))}
                {nodeDetails.dependencies && nodeDetails.dependencies.length > 8 && <li style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px 10px' }}>+{nodeDetails.dependencies.length - 8} more</li>}
                {(!nodeDetails.dependencies || nodeDetails.dependencies.length === 0) && <li style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>None</li>}
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Imported By <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{nodeDetails.dependents ? nodeDetails.dependents.length : 0}</span>
              </h4>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {nodeDetails.dependents && nodeDetails.dependents.slice(0, 8).map(d => (
                  <li key={d} style={{ fontSize: '0.85rem', color: '#64748b', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '4px', borderLeft: '2px solid #a855f7', fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => onNodeClick(d)}>{d}</li>
                ))}
                {nodeDetails.dependents && nodeDetails.dependents.length > 8 && <li style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px 10px' }}>+{nodeDetails.dependents.length - 8} more</li>}
                {(!nodeDetails.dependents || nodeDetails.dependents.length === 0) && <li style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>None</li>}
              </ul>
            </div>
          </div>

          {/* Fixed Footer for Trace Button */}
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <button 
               className="trace-action-btn" 
               style={{ 
                 width: '100%', 
                 padding: '14px', 
                 background: 'linear-gradient(135deg, var(--accent) 0%, #4f46e5 100%)', 
                 color: 'white', 
                 border: 'none', 
                 borderRadius: '8px', 
                 fontWeight: 'bold',
                 fontSize: '0.95rem',
                 cursor: 'pointer',
                 boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                 transition: 'all 0.2s ease',
                 display: 'flex',
                 justifyContent: 'center',
                 alignItems: 'center',
                 gap: '8px'
               }}
               onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.6)'; }}
               onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.4)'; }}
               onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'trace' } }))}
            >
              <Activity size={18} /> Trace Execution Flow
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const GraphView = (props) => (
  <ReactFlowProvider>
    <GraphViewInner {...props} />
  </ReactFlowProvider>
);

/* ══════════════════════════════════════════════════════════════
   AI Chat Component
   ══════════════════════════════════════════════════════════════ */
const AIChatView = ({ repoUrl, messages, setMessages, searchGraph }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (forcedQuery = null) => {
    const userMsg = typeof forcedQuery === 'string' ? forcedQuery : input.trim();
    if (!userMsg) return;
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/api/chat', { query: userMsg, repoUrl });
      if (res.data.success) {
        const text = res.data.data.answer || res.data.data.response;
        setMessages(prev => [...prev, { role: 'ai', content: text }]);
        const match = text.match(/[a-zA-Z0-9_\-\/]+\.(js|py|ts|jsx|tsx|go|java)/g);
        if (match && match.length > 0) {
           searchGraph(match[0]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: 'Error: ' + res.data.error.message }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Failed to communicate with AI: ' + (err.response?.data?.error?.message || err.message) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      {messages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0, animation: 'fadeInGraph 0.5s forwards' }}>
          <div style={{ padding: '20px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', marginBottom: '20px' }}>
            <MessageSquare size={48} color="var(--accent)" />
          </div>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>Apex Think Assistant</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '400px', lineHeight: '1.6', marginBottom: '40px' }}>
            Ask me anything about your codebase — architecture, flow, or logical structures.
          </p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', maxWidth: '600px' }}>
            <button className="suggestion-chip" onClick={() => handleSend("Explain project structure")}>Explain project structure</button>
            <button className="suggestion-chip" onClick={() => handleSend("Where is authentication handled?")}>Where is authentication?</button>
            <button className="suggestion-chip" onClick={() => handleSend("Show the execution flow starting from main")}>Show execution flow</button>
            <button className="suggestion-chip" onClick={() => handleSend("How does the database align with routes?")}>Database integration</button>
          </div>
        </div>
      ) : (
        <div className="chat-history">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`} dangerouslySetInnerHTML={{ __html: msg.content.replace(/\\n/g, '<br/>') }} />
          ))}
          {loading && (
            <div className="chat-message ai">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="chat-input-area">
        <input 
          className="chat-input" 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="e.g. Expand on the authentication flow..." 
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={loading}>Send</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Onboarding Path View
   ══════════════════════════════════════════════════════════════ */
const OnboardingView = ({ repoUrl, data, onNodeClick }) => {
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const roleColors = {
    entry:   { bg: 'rgba(0,150,255,0.15)',   text: '#60a5fa',  border: 'rgba(0,150,255,0.3)'   },
    core:    { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc',  border: 'rgba(168,85,247,0.3)'  },
    service: { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24',  border: 'rgba(245,158,11,0.3)'  },
    model:   { bg: 'rgba(239,68,68,0.15)',   text: '#f87171',  border: 'rgba(239,68,68,0.3)'   },
    utility: { bg: 'rgba(16,185,129,0.15)',  text: '#34d399',  border: 'rgba(16,185,129,0.3)'  },
    config:  { bg: 'rgba(100,100,100,0.15)', text: '#94a3b8',  border: 'rgba(100,100,100,0.3)' },
  };

  const generatePath = async () => {
    if (!data?.dependencyGraph?.nodes) return;
    setLoading(true);
    setError(null);
    setPath([]); // clear stale data
    try {
      // Send plain string node IDs — backend handles categorization
      const nodeIds = data.dependencyGraph.nodes.map(n => typeof n === 'string' ? n : n.id || '').filter(Boolean);
      const res = await axios.post('/api/onboarding', {
        repoUrl,
        nodes: nodeIds,
        edges: (data.dependencyGraph.edges || []).map(e => ({ source: e.source || e.from, target: e.target || e.to })),
        bust: Date.now() // force cache-bypass on regenerate
      });
      if (res.data.success) {
        let steps = res.data.data.path || [];

        // Normalise: single-file format → grouped format
        if (steps.length > 0 && steps[0].file && !steps[0].files) {
          steps = steps.map(s => ({
            ...s,
            files: [s.file],
            title: s.title || s.file.split('/').pop() || s.file,
            role: (!s.role || s.role === 'unknown') ? 'core' : s.role,
            description: s.reason || s.explanation || s.description || 'Explore this file.'
          }));
        }

        // Filter out any remaining unknown/empty steps
        steps = steps.filter(s => s.title || (s.files && s.files.length > 0));

        setPath(steps);
      } else {
        setError('Failed to generate onboarding path.');
      }
    } catch (err) {
      setError(err.message || 'AI Generation error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (path.length === 0 && data) generatePath();
  }, [data]);

  const stepIcons = ['🚀', '⚙️', '🔧', '🗄️', '🛠️', '⚡'];

  return (
    <div className="feature-page" style={{ height: '100%', overflowY: 'auto', paddingRight: '15px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 className="feature-title" style={{ marginBottom: '8px' }}>AI Onboarding Path</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Your step-by-step guide to mastering this codebase.</p>
        </div>
        <button className="chat-send-btn" onClick={generatePath} disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Generating...' : '↺ Regenerate'}
        </button>
      </div>

      {loading && (
        <div className="loader-container" style={{ margin: '60px 0' }}>
          <div className="spinner"></div>
          Generating your personalized learning path...
        </div>
      )}

      {error && !loading && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '16px 20px', borderRadius: '10px', marginBottom: '20px' }}>
          <strong style={{ color: '#f87171' }}>⚠ {error}</strong>
          <button onClick={generatePath} style={{ marginLeft: '16px', background: 'transparent', border: '1px solid #f87171', color: '#f87171', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {!loading && path.length > 0 && (
        <div style={{ position: 'relative', paddingLeft: '16px', borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
          {path.map((step, i) => {
            const role = (step.role || 'core').toLowerCase();
            const colors = roleColors[role] || roleColors.core;
            const files = step.files || (step.file ? [step.file] : []);

            return (
              <div key={i} style={{ marginBottom: '28px', position: 'relative', animation: `fadeInGraph 0.5s ease-out backwards`, animationDelay: `${i * 0.12}s` }}>
                {/* Timeline dot */}
                <div style={{ position: 'absolute', left: '-24px', top: '20px', width: '14px', height: '14px', borderRadius: '50%', background: colors.text, boxShadow: `0 0 10px ${colors.text}` }} />

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: `1px solid ${colors.border}`, padding: '22px 24px', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {stepIcons[i] || '📁'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>Step {step.step || i + 1}</span>
                        <span style={{ background: colors.bg, color: colors.text, padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>{role}</span>
                      </div>
                      <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', color: '#f8fafc' }}>{step.title}</h3>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ margin: '0 0 16px', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6' }}>{step.description}</p>

                  {/* File chips */}
                  {files.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: step.why_next ? '14px' : '0' }}>
                      {files.map(f => (
                        <button key={f} onClick={() => onNodeClick(f)}
                          style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${colors.border}`, color: colors.text, padding: '5px 12px', borderRadius: '6px', fontSize: '0.82rem', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
                        >
                          <Network size={12} />{f.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Why next */}
                  {step.why_next && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 'bold', marginRight: '6px' }}>Why next?</span>
                        {step.why_next}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && path.length === 0 && (
        <div className="empty-state">
          <p>Click <strong>Regenerate</strong> to build your onboarding path.</p>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   History / Trace / Score Views
   ══════════════════════════════════════════════════════════════ */
const HistoryView = ({ history, loadingHistory }) => {
  if (loadingHistory) return <div className="loader-container"><div className="spinner"></div>Loading timeline...</div>;

  return (
    <div className="feature-page" style={{ height: '100%', overflowY: 'auto', paddingRight: '15px' }}>
      <h2 className="feature-title">Git History Timeline</h2>
      {!history || history.length === 0 ? <p className="empty-state">No history available for this repository.</p> : (
        <div style={{ padding: '10px 0 20px', position: 'relative', borderLeft: '3px solid rgba(255, 255, 255, 0.1)', marginLeft: '12px' }}>
          {history.map((commit, i) => (
            <div key={i} style={{ marginBottom: '24px', position: 'relative', paddingLeft: '30px' }}>
              {/* Pulsing Dot */}
              <div style={{ position: 'absolute', left: '-8px', top: '2px', width: '13px', height: '13px', background: 'var(--accent)', borderRadius: '50%', border: '3px solid var(--bg-panel)', boxShadow: '0 0 12px var(--accent)', transition: 'background 0.3s' }}></div>
              
              {/* Commit Card */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '1rem', lineHeight: '1.4', wordBreak: 'break-word', color: '#e2e8f0', flex: 1, paddingRight: '10px' }}>
                    {commit.message || 'No commit message'}
                  </strong>
                  <span style={{ background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                    {commit.sha?.slice(0,7) || commit.hash?.slice(0,7) || 'unknown'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {commit.avatar ? (
                    <img src={commit.avatar} alt={commit.author} style={{ width: 22, height: 22, borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>
                      {commit.author ? commit.author.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  <span style={{ fontWeight: '500', color: '#cbd5e1' }}>{commit.author || 'Unknown'}</span>
                  <span>•</span>
                  <span>{commit.date ? new Date(commit.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TraceView = ({ repoUrl, selectedFile, onNodeClick }) => {
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entryInput, setEntryInput] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedFile) setEntryInput(selectedFile);
  }, [selectedFile]);

  const handleTrace = async () => {
    if (!entryInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/trace', { entry: entryInput, repoUrl });
      if (res.data.success) {
        if (!res.data.data.flow || res.data.data.flow.length === 0) {
          setError("No execution flow found");
          setTraceData(null);
        } else {
          setTraceData(res.data.data.flow);
        }
      } else {
        setError(res.data.error?.message || 'No execution flow found');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feature-page" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center', height: '100%', overflowY: 'auto' }}>
      <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
        <h2 className="feature-title" style={{ fontSize: '2rem', marginBottom: '10px' }}>Execution Flow</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '1.05rem' }}>Map the architectural pathway sequentially from an entry point.</p>
        
        <div className="chat-input-area" style={{ background: 'var(--bg-panel)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <input 
            className="chat-input" 
            style={{ border: 'none', background: 'transparent', fontSize: '1rem', padding: '12px' }}
            value={entryInput} 
            onChange={e => setEntryInput(e.target.value)} 
            placeholder="e.g. index.js (or select from Graph)" 
          />
          <button className="chat-send-btn" onClick={handleTrace} disabled={loading} style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 'bold' }}>
            {loading ? 'Tracing execution...' : 'Run Trace'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '16px 24px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '1.05rem', marginTop: '20px' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
          Tracing execution...
        </div>
      )}

      {!traceData && !loading && !error && (
        <div className="empty-state" style={{ marginTop: '40px', padding: '40px', width: '100%', maxWidth: '600px' }}>
          <Activity size={64} style={{ opacity: 0.2, marginBottom: '24px' }} />
          <p style={{ fontSize: '1.1rem' }}>Initiate a trace to visualize code execution paths.</p>
        </div>
      )}

      {traceData && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'center', marginTop: '30px', maxWidth: '900px', width: '100%' }}>
          {traceData.map((step, i) => (
            <React.Fragment key={i}>
              <div 
                title={`Execution step ${i + 1}: Click to view File details in Graph`}
                style={{ 
                  background: '#1e1e2f', padding: '14px 22px', borderRadius: '12px', 
                  border: '1px solid rgba(255, 255, 255, 0.08)', color: 'white',
                  fontSize: '15px', fontWeight: '500', fontFamily: 'monospace',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)', cursor: 'pointer',
                  opacity: 0, transform: 'translateY(15px)',
                  animation: 'fadeInTrace 0.4s forwards',
                  animationDelay: `${i * 0.15}s`,
                  transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
                onClick={() => onNodeClick(step)}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Step {i + 1}</span>
                {step.split('/').pop()}
              </div>
              {i < traceData.length - 1 && (
                <div style={{ 
                  color: '#888', fontSize: '22px', 
                  animation: 'pulseArrow 2s infinite ease-in-out', 
                  animationDelay: `${i * 0.15 + 0.1}s`,
                  opacity: 0,
                  animationFillMode: 'forwards'
                }}>
                  ➔
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const ScoreView = ({ scoreData, loadingScore }) => {
  if (loadingScore) return <div className="loader-container"><div className="spinner"></div>Analyzing Code Consistency...</div>;
  if (!scoreData) return <div className="empty-state">Unable to load score data.</div>;

  const { overall, cleanliness, complexity, structure, naming, issues, suggestions } = scoreData;

  const ProgressBar = ({ label, score, color }) => {
    const [w, setW] = useState(0);
    useEffect(() => { setTimeout(() => setW(score), 300); }, [score]);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#cbd5e1', fontWeight: '500' }}>
          <span>{label}</span>
          <span>{score}/100</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${w}%`, background: color }} />
        </div>
      </div>
    );
  };

  return (
    <div className="feature-page" style={{ maxWidth: '900px' }}>
      <h2 className="feature-title" style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '40px' }}>Code Quality Dashboard</h2>
      
      <div className="score-dashboard">
        
        {/* Main Header Card */}
        <div className="score-main-card">
          <div className="score-circle-wrapper">
            {overall}
          </div>
          <div className="breakdown-bars">
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: 'white' }}>Metric Breakdown</h3>
            <ProgressBar label="Cleanliness" score={cleanliness} color="#10b981" />
            <ProgressBar label="Complexity" score={complexity} color="#3b82f6" />
            <ProgressBar label="Structure" score={structure} color="#8b5cf6" />
            <ProgressBar label="Naming" score={naming} color="#f59e0b" />
          </div>
        </div>

        {/* Lower Grid Cards */}
        <div className="score-grid">
          
          <div className="dashboard-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <Activity size={20} color="var(--accent)" /> System Issues
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontWeight: 'bold' }}>🔴 Critical</span>
                <span style={{ fontSize: '1.1rem', color: 'white', fontWeight: 'bold' }}>{issues?.critical || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(245, 158, 11, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fcd34d', fontWeight: 'bold' }}>🟠 Warning</span>
                <span style={{ fontSize: '1.1rem', color: 'white', fontWeight: 'bold' }}>{issues?.warning || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6ee7b7', fontWeight: 'bold' }}>🟢 Good</span>
                <span style={{ fontSize: '1.1rem', color: 'white', fontWeight: 'bold' }}>{issues?.good || 0}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <CheckCircle size={20} color="#10b981" /> AI Actionable Suggestions
            </h3>
            <ul style={{ paddingLeft: '20px', margin: '16px 0 0 0', display: 'flex', flexDirection: 'column', gap: '12px', color: '#cbd5e1', fontSize: '0.95rem' }}>
              {suggestions && suggestions.map((sug, idx) => (
                <li key={idx} style={{ lineHeight: '1.5' }}>{sug}</li>
              ))}
              {(!suggestions || suggestions.length === 0) && (
                <li style={{ color: '#94a3b8', listStyle: 'none', marginLeft: '-20px' }}>Looking great! No major suggestions.</li>
              )}
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Main Dashboard
   ══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const repoUrl = searchParams.get('url');

  const [activeTab, setActiveTab] = useState('graph');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [repoData, setRepoData] = useState(null);
  const [loadingRepo, setLoadingRepo] = useState(true);
  const [repoError, setRepoError] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: 'Hello! I have analyzed the repository. Ask me anything about its structure, authentication, or architecture.' }
  ]);

  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);

  useEffect(() => {
    const handleNavigation = (e) => setActiveTab(e.detail.tab);
    window.addEventListener('navigate', handleNavigation);
    return () => window.removeEventListener('navigate', handleNavigation);
  }, []);

  useEffect(() => {
    if (!repoUrl) {
      setRepoError('No repository URL provided.');
      setLoadingRepo(false);
      return;
    }

    setLoadingRepo(true);
    axios.get("/api/repo?url=" + encodeURIComponent(repoUrl))
      .then(res => {
        if (res.data.success) setRepoData(res.data.data);
        else setRepoError(res.data.error?.message || 'Failed to load repository.');
      })
      .catch(err => setRepoError(err.response?.data?.error?.message || err.message))
      .finally(() => setLoadingRepo(false));

    setLoadingHistory(true);
    axios.get("/api/history?url=" + encodeURIComponent(repoUrl))
      .then(res => setHistoryData(res.data.data.commits || []))
      .catch(err => console.error("History fetch failed", err))
      .finally(() => setLoadingHistory(false));

    setLoadingScore(true);
    axios.get("/api/score?url=" + encodeURIComponent(repoUrl))
      .then(res => setScoreData(res.data.data))
      .finally(() => setLoadingScore(false));

  }, [repoUrl]);

  const handleNodeClick = useCallback((nodeId) => {
    setSelectedFile(nodeId); 
  }, []);

  const renderContent = () => {
    if (loadingRepo) return <div className="loader-container"><div className="spinner"></div>Synchronizing Repository...</div>;
    if (repoError) return <div className="empty-state"><h3>Error</h3><p>{repoError}</p></div>;

    switch (activeTab) {
      case 'graph':   
        return <GraphView data={repoData} searchQuery={searchQuery} onNodeClick={handleNodeClick} selectedNode={selectedFile} repoUrl={repoUrl} />;
      case 'chat':    
        return <AIChatView repoUrl={repoUrl} messages={chatMessages} setMessages={setChatMessages} searchGraph={setSearchQuery} />;
      case 'onboarding':
        return <OnboardingView repoUrl={repoUrl} data={repoData} onNodeClick={(nodeId) => { handleNodeClick(nodeId); setActiveTab('graph'); }} />;
      case 'history': 
        return <HistoryView history={historyData} loadingHistory={loadingHistory} />;
      case 'trace':   
        return <TraceView repoUrl={repoUrl} selectedFile={selectedFile} onNodeClick={(nodeId) => { handleNodeClick(nodeId); setActiveTab('graph'); }} />;
      case 'score':   
        return <ScoreView scoreData={scoreData} loadingScore={loadingScore} />;
      default:        
        return <GraphView data={repoData} searchQuery={searchQuery} onNodeClick={handleNodeClick} selectedNode={selectedFile} repoUrl={repoUrl} />;
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <Network size={24} color="var(--accent)" />
          Apex Think
        </div>
        
        <div className={"nav-item " + (activeTab === 'graph' ? 'active' : '')} onClick={() => setActiveTab('graph')}>
          <Network size={18} /> Graph View
        </div>
        <div className={"nav-item " + (activeTab === 'chat' ? 'active' : '')} onClick={() => setActiveTab('chat')}>
          <MessageSquare size={18} /> AI Chat
        </div>
        <div className={"nav-item " + (activeTab === 'onboarding' ? 'active' : '')} onClick={() => setActiveTab('onboarding')}>
          <BookOpen size={18} /> Onboarding Path
        </div>
        <div className={"nav-item " + (activeTab === 'history' ? 'active' : '')} onClick={() => setActiveTab('history')}>
          <GitBranch size={18} /> Git History
        </div>
        <div className={"nav-item " + (activeTab === 'trace' ? 'active' : '')} onClick={() => setActiveTab('trace')}>
          <Activity size={18} /> Execution Trace
        </div>
        <div className={"nav-item " + (activeTab === 'score' ? 'active' : '')} onClick={() => setActiveTab('score')}>
          <CheckCircle size={18} /> Code Score
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="top-bar">
          <div className="repo-badge">
            <GitBranch size={14} />
            {repoUrl ? repoUrl.replace('https://github.com/', '') : 'No Repository'}
          </div>
          {selectedFile && (
            <div className="repo-badge" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
              <FileText size={14} />
              {selectedFile.split('/').pop()}
            </div>
          )}
          <div style={{ flex: 1 }}></div>
          
          {/* Search Feature */}
          <div className="search-container" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px' }}>
            <Search size={14} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input 
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'graph') setActiveTab('graph'); 
              }}
              placeholder="Natural language sync search..."
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '0.85rem', width: '220px' }}
            />
          </div>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
