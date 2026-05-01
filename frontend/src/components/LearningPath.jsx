import React, { useState, useEffect } from 'react';
import { Network } from 'lucide-react';
import { fetchLearningPath } from '../services/api';

export default function LearningPath({ repoUrl, data, onNodeClick }) {
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generatePath = async () => {
    if (!data?.dependencyGraph?.nodes) return;
    setLoading(true);
    setError(null);
    setPath([]); 
    try {
      const nodeIds = data.dependencyGraph.nodes.map(n => typeof n === 'string' ? n : n.id || '').filter(Boolean);
      const edges = (data.dependencyGraph.edges || []).map(e => ({ source: e.source || e.from, target: e.target || e.to }));
      const res = await fetchLearningPath(repoUrl, nodeIds, edges);
      if (res.success) {
        let steps = res.data.path || [];

        if (steps.length > 0 && steps[0].file && !steps[0].files) {
          steps = steps.map(s => ({
            ...s,
            files: [s.file],
            title: s.title || s.file.split('/').pop() || s.file,
            role: (!s.role || s.role === 'unknown') ? 'core' : s.role,
            description: s.reason || s.explanation || s.description || 'Explore this file.'
          }));
        }

        steps = steps.filter(s => s.title || (s.files && s.files.length > 0));
        setPath(steps);
      } else {
        setError('Failed to generate onboarding path.');
      }
    } catch (err) {
      setError(err.message || 'Error making path');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (path.length === 0 && data) generatePath();
  }, [data]);

  return (
    <div className="feature-page" style={{ height: '100%', overflowY: 'auto', paddingRight: '15px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 className="feature-title" style={{ marginBottom: '8px' }}>Learning Path</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Step-by-step guide to reading the code.</p>
        </div>
        <button className="chat-send-btn" onClick={generatePath} disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Thinking...' : '↺ Regenerate'}
        </button>
      </div>

      {loading && (
        <div className="loader-container" style={{ margin: '60px 0' }}>
          <div className="spinner"></div>
          Generating learning path...
        </div>
      )}

      {error && !loading && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '16px 20px', borderRadius: '10px', marginBottom: '20px' }}>
          <strong style={{ color: '#f87171' }}>Error: {error}</strong>
        </div>
      )}

      {!loading && path.length > 0 && (
        <div style={{ position: 'relative', paddingLeft: '16px', borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
          {path.map((step, i) => {
            const files = step.files || (step.file ? [step.file] : []);

            return (
              <div key={i} style={{ marginBottom: '28px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-24px', top: '20px', width: '14px', height: '14px', borderRadius: '50%', background: '#60a5fa' }} />

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: `1px solid rgba(255,255,255,0.1)`, padding: '22px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)' }}>Step {i + 1}</span>
                      <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', color: '#f8fafc' }}>{step.title}</h3>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 16px', color: '#cbd5e1', fontSize: '0.95rem' }}>{step.description}</p>

                  {files.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {files.map(f => (
                        <button key={f} onClick={() => onNodeClick(f)}
                          style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid #333`, color: 'white', padding: '5px 12px', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Network size={12} />{f.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
