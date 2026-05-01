import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle } from 'lucide-react';

export default function QualityScore({ scoreData, loadingScore }) {
  if (loadingScore) return <div className="loader-container"><div className="spinner"></div>Calculating score...</div>;
  if (!scoreData) return <div className="empty-state">No score data available.</div>;

  const { overall, cleanliness, complexity, structure, naming, issues, suggestions } = scoreData;

  const ProgressBar = ({ label, score, color }) => {
    const [w, setW] = useState(0);
    useEffect(() => { setTimeout(() => setW(score), 300); }, [score]);
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#cbd5e1' }}>
          <span>{label}</span>
          <span>{score}/100</span>
        </div>
        <div className="progress-track" style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
          <div className="progress-fill" style={{ width: `${w}%`, background: color, height: '100%', transition: 'width 1s ease' }} />
        </div>
      </div>
    );
  };

  return (
    <div className="feature-page" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2 className="feature-title" style={{ textAlign: 'center', marginBottom: '30px' }}>Code Quality</h2>
      
      <div className="score-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Main Header Card */}
        <div className="score-main-card" style={{ display: 'flex', gap: '30px', background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div className="score-circle-wrapper" style={{ flex: '0 0 150px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent)', border: '4px solid var(--accent)', borderRadius: '50%', height: '150px' }}>
            {overall}
          </div>
          <div className="breakdown-bars" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <ProgressBar label="Cleanliness" score={cleanliness} color="#10b981" />
            <ProgressBar label="Complexity" score={complexity} color="#3b82f6" />
            <ProgressBar label="Structure" score={structure} color="#8b5cf6" />
            <ProgressBar label="Naming" score={naming} color="#f59e0b" />
          </div>
        </div>

        {/* Lower Grid Cards */}
        <div className="score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <div className="dashboard-card" style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <Activity size={20} color="var(--accent)" /> Issues Found
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ color: '#fca5a5' }}>🔴 Critical</span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{issues?.critical || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(245, 158, 11, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ color: '#fcd34d' }}>🟠 Warning</span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{issues?.warning || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ color: '#6ee7b7' }}>🟢 Good</span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{issues?.good || 0}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-card" style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <CheckCircle size={20} color="#10b981" /> Suggestions
            </h3>
            <ul style={{ paddingLeft: '20px', margin: '16px 0 0 0', display: 'flex', flexDirection: 'column', gap: '12px', color: '#cbd5e1' }}>
              {suggestions && suggestions.map((sug, idx) => (
                <li key={idx}>{sug}</li>
              ))}
              {(!suggestions || suggestions.length === 0) && (
                <li style={{ color: '#94a3b8', listStyle: 'none', marginLeft: '-20px' }}>Looking great! No suggestions.</li>
              )}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
