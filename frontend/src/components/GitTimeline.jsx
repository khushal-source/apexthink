import React from 'react';

export default function GitTimeline({ history, loadingHistory }) {
  if (loadingHistory) return <div className="loader-container"><div className="spinner"></div>Loading timeline...</div>;

  return (
    <div className="feature-page" style={{ height: '100%', overflowY: 'auto', paddingRight: '15px' }}>
      <h2 className="feature-title">Git History</h2>
      {!history || history.length === 0 ? <p className="empty-state">No history available for this repo.</p> : (
        <div style={{ padding: '10px 0 20px', position: 'relative', borderLeft: '3px solid rgba(255, 255, 255, 0.1)', marginLeft: '12px' }}>
          {history.map((commit, i) => (
            <div key={i} style={{ marginBottom: '24px', position: 'relative', paddingLeft: '30px' }}>
              <div style={{ position: 'absolute', left: '-8px', top: '2px', width: '13px', height: '13px', background: 'var(--accent)', borderRadius: '50%' }}></div>
              
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '1rem', color: '#e2e8f0', flex: 1, paddingRight: '10px' }}>
                    {commit.message || 'No commit message'}
                  </strong>
                  <span style={{ background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {commit.sha?.slice(0,7) || commit.hash?.slice(0,7) || 'unknown'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {commit.avatar ? (
                    <img src={commit.avatar} alt={commit.author} style={{ width: 22, height: 22, borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>
                      {commit.author ? commit.author.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  <span>{commit.author || 'Unknown'}</span>
                  <span>•</span>
                  <span>{commit.date ? new Date(commit.date).toLocaleDateString() : 'Unknown Date'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
