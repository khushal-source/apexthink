import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Network, MessageSquare, GitBranch, Activity, CheckCircle, Search } from 'lucide-react';
import { ReactFlow, Controls, Background } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/* ══════════════════════════════════════════════════════════════
   Graph View Component
   ══════════════════════════════════════════════════════════════ */
const GraphView = ({ data }) => {
  if (!data || !data.nodes) return <div className="loader-container">No graph data available.</div>;

  const nodes = data.nodes.map(n => ({
    id: n.id,
    data: { label: n.label || n.id },
    position: n.position || { x: Math.random() * 500, y: Math.random() * 500 },
    className: n.isEntry ? 'react-flow__node-custom entry' : 'react-flow__node-custom',
  }));

  const edges = (data.edges || []).map((e, i) => ({
    id: "e" + i,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: 'var(--accent)' }
  }));

  return (
    <div className="view-container">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="#2a2a2c" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   AI Chat Component
   ══════════════════════════════════════════════════════════════ */
const AIChatView = ({ repoUrl }) => {
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hello! I have analyzed the repository. Ask me anything about its structure, authentication, or architecture.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/api/chat', { query: userMsg, repoUrl });
      if (res.data.success) {
        setMessages(prev => [...prev, { role: 'ai', content: res.data.data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: 'Error: ' + res.data.error.message }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Failed to communicate with AI.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-history">
        {messages.map((msg, idx) => (
          <div key={idx} className={"chat-message " + msg.role}>
            {msg.content}
          </div>
        ))}
        {loading && <div className="chat-message ai">Thinking...</div>}
      </div>
      <div className="chat-input-area">
        <input 
          className="chat-input" 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="e.g. Where is authentication handled?" 
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={loading}>Send</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Others Views
   ══════════════════════════════════════════════════════════════ */
const HistoryView = ({ repoUrl }) => {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/history?url=" + encodeURIComponent(repoUrl))
      .then(res => {
        setHistory(res.data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [repoUrl]);

  if (loading) return <div className="loader-container"><div className="spinner"></div>Loading timeline...</div>;

  return (
    <div className="feature-page">
      <h2 className="feature-title">Git History Timeline</h2>
      {!history || history.length === 0 ? <p className="empty-state">No history available.</p> : (
        <div className="timeline">
          {history.map((commit, i) => (
            <div key={i} className="timeline-item">
              <span className="timestamp">{commit.date || 'Unknown Date'} • {commit.author || 'Unknown'}</span>
              <strong>{commit.message}</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{commit.hash}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TraceView = ({ repoUrl }) => {
  return (
    <div className="feature-page">
      <h2 className="feature-title">Execution Trace</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Enter an entry file to visualize code execution path.</p>
      
      <div className="empty-state">
        <Activity size={48} style={{ opacity: 0.3, marginBottom: '20px' }} />
        <p>Execution trace requires deeper codebase analysis.</p>
      </div>
    </div>
  );
};

const ScoreView = ({ repoUrl }) => {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/score?url=" + encodeURIComponent(repoUrl))
      .then(res => {
        setScoreData(res.data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [repoUrl]);

  if (loading) return <div className="loader-container"><div className="spinner"></div>Analyzing Code Consistency...</div>;

  const score = scoreData ? scoreData.score : 0;
  
  return (
    <div className="feature-page">
      <h2 className="feature-title">Code Quality & Consistency</h2>
      <div className="score-container">
        <div className="score-circle">
          {score}
        </div>
        <div className="issues-list">
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Observations</h3>
          <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-muted)' }}>
            {scoreData?.issues?.map((issue, idx) => (
              <li key={idx} style={{ marginBottom: '8px' }}>{issue}</li>
            ))}
            {(!scoreData?.issues || scoreData.issues.length === 0) && <li>No specific issues detected.</li>}
          </ul>
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
  const [repoData, setRepoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!repoUrl) {
      setError('No repository URL provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    axios.get("/api/repo?url=" + encodeURIComponent(repoUrl))
      .then(res => {
        if (res.data.success) {
          setRepoData(res.data.data);
        } else {
          setError(res.data.error?.message || 'Failed to load repository.');
        }
      })
      .catch(err => {
        setError(err.response?.data?.error?.message || err.message || 'Network error.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [repoUrl]);

  const renderContent = () => {
    if (loading) return <div className="loader-container"><div className="spinner"></div>Synchronizing Repository...</div>;
    if (error) return <div className="empty-state"><h3>Error</h3><p>{error}</p></div>;

    switch (activeTab) {
      case 'graph':   return <GraphView data={repoData} />;
      case 'chat':    return <AIChatView repoUrl={repoUrl} />;
      case 'history': return <HistoryView repoUrl={repoUrl} />;
      case 'trace':   return <TraceView repoUrl={repoUrl} />;
      case 'score':   return <ScoreView repoUrl={repoUrl} />;
      default:        return <GraphView data={repoData} />;
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <Network size={24} color="var(--accent)" />
          CodeMap AI
        </div>
        
        <div 
          className={"nav-item " + (activeTab === 'graph' ? 'active' : '')} 
          onClick={() => setActiveTab('graph')}
        >
          <Network size={18} /> Graph View
        </div>
        <div 
          className={"nav-item " + (activeTab === 'chat' ? 'active' : '')} 
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={18} /> AI Chat
        </div>
        <div 
          className={"nav-item " + (activeTab === 'history' ? 'active' : '')} 
          onClick={() => setActiveTab('history')}
        >
          <GitBranch size={18} /> Git History
        </div>
        <div 
          className={"nav-item " + (activeTab === 'trace' ? 'active' : '')} 
          onClick={() => setActiveTab('trace')}
        >
          <Activity size={18} /> Execution Trace
        </div>
        <div 
          className={"nav-item " + (activeTab === 'score' ? 'active' : '')} 
          onClick={() => setActiveTab('score')}
        >
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
          <div style={{ flex: 1 }}></div>
          <div className="repo-badge" style={{ cursor: 'pointer' }}>
            <Search size={14} /> Search
          </div>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
