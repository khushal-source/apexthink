import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ReactFlow, Background, useNodesState, useEdgesState, ReactFlowProvider, BackgroundVariant } from '@xyflow/react';
import { Activity } from 'lucide-react';
import { fetchExplanation } from '../services/api';
import '@xyflow/react/dist/style.css';

// Mobile detection hook
const useIsMobile = () => window.innerWidth < 768;

// Utility to figure out what kind of file this is based on imports/exports
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

    // TODO: Need a better way to check for main files, this is kinda hacky
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

const GraphViewInner = ({ data, searchQuery, onNodeClick, selectedNode, repoUrl }) => {
  const [nodeDetails, setNodeDetails] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const isMobile = useIsMobile();

  // Derive graph categories
  const graphAnalysis = useMemo(() => {
    if (!data?.dependencyGraph || !data.dependencyGraph.nodes) return {};
    return analyzeNodes(data.dependencyGraph.nodes, data.dependencyGraph.edges || []);
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Initial load — limit nodes on mobile for performance
  useEffect(() => {
    if (!data || !data.dependencyGraph) return;

    let validNodes = Array.isArray(data.dependencyGraph.nodes) ? data.dependencyGraph.nodes : [];
    const validEdgesRaw = Array.isArray(data.dependencyGraph.edges) ? data.dependencyGraph.edges : [];

    // On mobile, cap at 30 nodes to prevent lag
    if (isMobile && validNodes.length > 30) {
      validNodes = validNodes.slice(0, 30);
    }

    const validEdges = validEdgesRaw.filter(e => validNodes.includes(e.from) && validNodes.includes(e.to));

    const cols = Math.ceil(Math.sqrt(validNodes.length));
    const horizontalSpacing = isMobile ? 220 : 350;
    const verticalSpacing = isMobile ? 140 : 200;

    const initialNodes = validNodes.map((nodeId, idx) => {
      const xPos = (idx % cols) * horizontalSpacing;
      const yPos = Math.floor(idx / cols) * verticalSpacing;

      return {
        id: nodeId,
        position: { x: xPos, y: yPos },
        // Skip staggered animations on mobile
        style: isMobile ? {} : { animationDelay: (idx * 0.05) + 's' },
        className: "react-flow__node-custom", 
        data: { label: null }
      };
    });

    const initialMappedEdges = validEdges.map((e, idx) => {
      return {
        id: "e-" + e.from + "-" + e.to + "-" + idx,
        source: e.from,
        target: e.to,
        animated: !isMobile, // disable animated dashes on mobile
        style: { strokeDasharray: isMobile ? "none" : "5 5" }
      };
    });

    setNodes(initialNodes);
    setEdges(initialMappedEdges);
  }, [data, isMobile, setNodes, setEdges]);

  // Update styles on interaction
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
            <div title={`${nodeId}\nRole: ${analysis.type}`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '6px' : '10px', fontSize: isMobile ? '10px' : '11px' }}>
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
  }, [data, searchQuery, graphAnalysis, selectedNode, isMobile, setNodes, setEdges]);

  // Fetch summary when clicked
  useEffect(() => {
    if (!selectedNode) {
      setNodeDetails(null);
      return;
    }
    const analysis = graphAnalysis[selectedNode] || { dependencies: [], dependents: [], type: 'unknown' };
    setNodeDetails({ ...analysis, summary: null });
    setLoadingSummary(true);

    fetchExplanation(selectedNode, repoUrl)
    .then(data => {
      if (data.success) {
        setNodeDetails(prev => prev ? { ...prev, summary: data.data.summary || "No summary found." } : prev);
      } else {
        setNodeDetails(prev => prev ? { ...prev, summary: data.error?.message || "Error getting summary." } : prev);
      }
    })
    .catch(() => {
      setNodeDetails(prev => prev ? { ...prev, summary: "Error: Could not load summary." } : prev);
    })
    .finally(() => setLoadingSummary(false));

  }, [selectedNode, repoUrl, graphAnalysis]);

  const handleNodeClick = useCallback((evt, node) => {
    onNodeClick(node.id);
  }, [onNodeClick]);

  return (
    <div className="graph-view-root">
      <div className="graph-canvas-wrapper">
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: isMobile ? 0.05 : 0.2 }}
          // Touch-friendly settings
          panOnScroll={!isMobile}
          zoomOnPinch={true}
          zoomOnScroll={!isMobile}
          panOnDrag={true}
          preventScrolling={false}
        >
          <Background variant={BackgroundVariant.Dots} color="#888" gap={20} size={1.2} />
        </ReactFlow>

        {/* Hide legend on mobile to save space */}
        {!isMobile && (
          <div style={{ position: 'absolute', bottom: 20, right: 30, background: 'rgba(20,20,22,0.95)', padding: '15px 20px', borderRadius: '12px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)', zIndex: 100 }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Legend</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'var(--accent)', borderRadius:'50%' }}></div> Entry / Main</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'#10b981', borderRadius:'50%' }}></div> Utility</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'#a855f7', borderRadius:'50%' }}></div> Core Logic</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><div style={{ width:12, height:12, background:'#ef4444', borderRadius:'50%' }}></div> Orphan</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width:12, height:12, border:'2px solid #f59e0b', borderRadius:'50%' }}></div> High Impact</div>
          </div>
        )}
      </div>

      {selectedNode && nodeDetails && (
        <div className={`node-detail-panel ${isMobile ? 'mobile-panel' : ''}`}>
          
          <div style={{ padding: '20px 24px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', wordBreak: 'break-all', color: '#f8fafc', fontFamily: 'monospace' }}>{selectedNode}</h3>
              <button onClick={() => onNodeClick(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <span className={"badge " + (nodeDetails.type || "unknown")}>{(nodeDetails.type || "unknown").toUpperCase()}</span>
              {data.highImpactFiles && data.highImpactFiles.some(h => h.file === selectedNode) && <span className="badge high-impact">High Impact</span>}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8' }}>AI Summary</h4>
              {loadingSummary ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>Loading...</div>
              ) : (
                <div style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                  <span dangerouslySetInnerHTML={{ __html: nodeDetails.summary?.replace(/\n/g, '<br/>') || 'Summary missing.' }} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8' }}>Imports</h4>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', gap: '6px' }}>
                {nodeDetails.dependencies && nodeDetails.dependencies.slice(0, 8).map(d => (
                  <li key={d} style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }} onClick={() => onNodeClick(d)}>{d}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8' }}>Imported By</h4>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', gap: '6px' }}>
                {nodeDetails.dependents && nodeDetails.dependents.slice(0, 8).map(d => (
                  <li key={d} style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }} onClick={() => onNodeClick(d)}>{d}</li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
            <button 
               className="trace-action-btn" 
               style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
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

export default function RepoGraph(props) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}