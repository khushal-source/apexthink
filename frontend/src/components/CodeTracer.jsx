import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { fetchTrace } from '../services/api';

export default function CodeTracer({ repoUrl, selectedFile, onNodeClick }) {
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entryInput, setEntryInput] = useState('');
  const [error, setError] = useState(null);

  // update input if clicked from graph
  useEffect(() => {
    if (selectedFile) setEntryInput(selectedFile);
  }, [selectedFile]);

  const handleTrace = async () => {
    if (!entryInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrace(entryInput, repoUrl);
      if (data.success) {
        if (!data.data.flow || data.data.flow.length === 0) {
          setError("No execution flow found");
          setTraceData(null);
        } else {
          setTraceData(data.data.flow);
        }
      } else {
        setError(data.error?.message || 'No execution flow found');
      }
    } catch (err) {
      setError(err.message || "Error connecting to trace server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feature-page" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '600px' }}>
        <h2 className="feature-title">Execution Trace</h2>
        <p style={{ color: 'var(--text-muted)' }}>See how files are called starting from an entry point.</p>
        
        <div className="chat-input-area" style={{ background: 'var(--bg-panel)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <input 
            className="chat-input" 
            style={{ border: 'none', background: 'transparent', fontSize: '1rem', padding: '12px' }}
            value={entryInput} 
            onChange={e => setEntryInput(e.target.value)} 
            placeholder="e.g. src/index.js" 
          />
          <button className="chat-send-btn" onClick={handleTrace} disabled={loading} style={{ padding: '12px 24px' }}>
            {loading ? 'Tracing...' : 'Run Trace'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {!traceData && !loading && !error && (
        <div className="empty-state" style={{ marginTop: '40px' }}>
          <p>Initiate a trace to visualize execution.</p>
        </div>
      )}

      {traceData && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'center', marginTop: '30px' }}>
          {traceData.map((step, i) => (
            <React.Fragment key={i}>
              <div 
                style={{ 
                  background: '#1e1e2f', padding: '14px 22px', borderRadius: '12px', 
                  border: '1px solid rgba(255, 255, 255, 0.08)', color: 'white',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}
                onClick={() => onNodeClick(step)}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--accent)', marginBottom: '4px' }}>Step {i + 1}</span>
                {step.split('/').pop()}
              </div>
              {i < traceData.length - 1 && (
                <div style={{ color: '#888', fontSize: '22px' }}>➔</div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
