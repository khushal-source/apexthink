import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Network, MessageSquare, GitBranch, Activity, CheckCircle, Search, FileText, BookOpen } from 'lucide-react';
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
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <Network size={24} color="var(--accent)" />
          Apex Think
        </div>
        
        <div className="sidebar-nav">
          <div className={"nav-item " + (activeTab === 'graph' ? 'active' : '')} onClick={() => setActiveTab('graph')}>
            <Network size={18} /> Architecture Graph
          </div>
          <div className={"nav-item " + (activeTab === 'chat' ? 'active' : '')} onClick={() => setActiveTab('chat')}>
            <MessageSquare size={18} /> AI Chatbot
          </div>
          <div className={"nav-item " + (activeTab === 'onboarding' ? 'active' : '')} onClick={() => setActiveTab('onboarding')}>
            <BookOpen size={18} /> Learning Path
          </div>
          <div className={"nav-item " + (activeTab === 'history' ? 'active' : '')} onClick={() => setActiveTab('history')}>
            <GitBranch size={18} /> Git History
          </div>
          <div className={"nav-item " + (activeTab === 'trace' ? 'active' : '')} onClick={() => setActiveTab('trace')}>
            <Activity size={18} /> Code Trace
          </div>
          <div className={"nav-item " + (activeTab === 'score' ? 'active' : '')} onClick={() => setActiveTab('score')}>
            <CheckCircle size={18} /> Code Rating
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="top-bar">
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
