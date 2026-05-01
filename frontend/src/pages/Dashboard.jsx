import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Network, MessageSquare, GitBranch, Activity, CheckCircle, Search, FileText, BookOpen, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchRepoData, fetchHistory, fetchScore } from '../services/api';

// Import our split components
import RepoGraph from '../components/RepoGraph';
import ChatPanel from '../components/ChatPanel';
import LearningPath from '../components/LearningPath';
import GitTimeline from '../components/GitTimeline';
import CodeTracer from '../components/CodeTracer';
import QualityScore from '../components/QualityScore';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const repoUrl = searchParams.get('url');

  const [activeTab, setActiveTab] = useState('graph');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [repoData, setRepoData] = useState(null);
  const [loadingRepo, setLoadingRepo] = useState(true);
  const [repoError, setRepoError] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Default message to start the chat
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: 'Hey! I fetched the repo. Ask me anything about it.' }
  ]);

  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);

  // Listen for custom events (e.g. from the trace button in GraphView)
  useEffect(() => {
    const handleNavigation = (e) => setActiveTab(e.detail.tab);
    window.addEventListener('navigate', handleNavigation);
    return () => window.removeEventListener('navigate', handleNavigation);
  }, []);

  // Fetch all data when repo URL changes
  useEffect(() => {
    if (!repoUrl) {
      setRepoError('Oops, no repo URL provided.');
      setLoadingRepo(false);
      return;
    }

    setLoadingRepo(true);
    fetchRepoData(repoUrl)
      .then(data => {
        if (data.success) {
          setRepoData(data.data);
        } else {
          setRepoError(data.error?.message || 'Failed to load repo.');
        }
      })
      .catch(err => {
        setRepoError("Server error: " + err.message);
      })
      .finally(() => setLoadingRepo(false));

    // Get git history
    setLoadingHistory(true);
    fetchHistory(repoUrl)
      .then(data => setHistoryData(data.data?.commits || []))
      .catch(err => console.error("Could not fetch history", err)) // just log it, not critical
      .finally(() => setLoadingHistory(false));

    // Get score
    setLoadingScore(true);
    fetchScore(repoUrl)
      .then(data => setScoreData(data.data))
      .catch(err => console.error("Score fetch failed", err))
      .finally(() => setLoadingScore(false));

  }, [repoUrl]);

  const handleNodeClick = useCallback((nodeId) => {
    setSelectedFile(nodeId); 
  }, []);

  const renderContent = () => {
    if (loadingRepo) return <div className="loader-container"><div className="spinner"></div>Loading Repo... This might take a while for big ones.</div>;
    if (repoError) return <div className="empty-state"><h3>Error</h3><p>{repoError}</p></div>;

    switch (activeTab) {
      case 'graph':   
        return <RepoGraph data={repoData} searchQuery={searchQuery} onNodeClick={handleNodeClick} selectedNode={selectedFile} repoUrl={repoUrl} />;
      case 'chat':    
        return <ChatPanel repoUrl={repoUrl} messages={chatMessages} setMessages={setChatMessages} searchGraph={setSearchQuery} />;
      case 'onboarding':
        return <LearningPath repoUrl={repoUrl} data={repoData} onNodeClick={(nodeId) => { handleNodeClick(nodeId); setActiveTab('graph'); }} />;
      case 'history': 
        return <GitTimeline history={historyData} loadingHistory={loadingHistory} />;
      case 'trace':   
        return <CodeTracer repoUrl={repoUrl} selectedFile={selectedFile} onNodeClick={(nodeId) => { handleNodeClick(nodeId); setActiveTab('graph'); }} />;
      case 'score':   
        return <QualityScore scoreData={scoreData} loadingScore={loadingScore} />;
      default:        
        return <RepoGraph data={repoData} searchQuery={searchQuery} onNodeClick={handleNodeClick} selectedNode={selectedFile} repoUrl={repoUrl} />;
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Network size={24} color="var(--accent)" style={{ flexShrink: 0 }} />
            {!isSidebarCollapsed && <span>Apex Think</span>}
          </div>
          <button className="desktop-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} aria-label="Toggle Sidebar">
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close Sidebar">
            <X size={20} />
          </button>
        </div>
        
        <div className="sidebar-nav">
          <div className={"nav-item " + (activeTab === 'graph' ? 'active' : '')} onClick={() => { setActiveTab('graph'); setIsSidebarOpen(false); }}>
            <Network size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span>Architecture Graph</span>}
          </div>
          <div className={"nav-item " + (activeTab === 'chat' ? 'active' : '')} onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }}>
            <MessageSquare size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span>AI Chatbot</span>}
          </div>
          <div className={"nav-item " + (activeTab === 'onboarding' ? 'active' : '')} onClick={() => { setActiveTab('onboarding'); setIsSidebarOpen(false); }}>
            <BookOpen size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span>Learning Path</span>}
          </div>
          <div className={"nav-item " + (activeTab === 'history' ? 'active' : '')} onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}>
            <GitBranch size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span>Git History</span>}
          </div>
          <div className={"nav-item " + (activeTab === 'trace' ? 'active' : '')} onClick={() => { setActiveTab('trace'); setIsSidebarOpen(false); }}>
            <Activity size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span>Code Trace</span>}
          </div>
          <div className={"nav-item " + (activeTab === 'score' ? 'active' : '')} onClick={() => { setActiveTab('score'); setIsSidebarOpen(false); }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span>Code Rating</span>}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <div className="top-bar">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open Sidebar">
            <Menu size={20} />
          </button>
          <div className="repo-badge">
            <GitBranch size={14} />
            {repoUrl ? repoUrl.replace('https://github.com/', '') : 'No Repo'}
          </div>
          {selectedFile && (
            <div className="repo-badge" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
              <FileText size={14} />
              {selectedFile.split('/').pop()}
            </div>
          )}
          <div style={{ flex: 1 }}></div>
          
          <div className="search-container" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', flex: 1, minWidth: '150px' }}>
            <Search size={14} color="var(--text-muted)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input 
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'graph') setActiveTab('graph'); 
              }}
              placeholder="Search files..."
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '0.85rem', width: '100%' }}
            />
          </div>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
