import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { fetchChat } from '../services/api';

export default function ChatPanel({ repoUrl, messages, setMessages, searchGraph }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
      const data = await fetchChat(userMsg, repoUrl);
      if (data.success) {
        const text = data.data.answer || data.data.response;
        setMessages(prev => [...prev, { role: 'ai', content: text }]);
        
        // try to find a filename to highlight in the graph
        const match = text.match(/[a-zA-Z0-9_\-\/]+\.(js|py|ts|jsx|tsx|go|java)/g);
        if (match && match.length > 0) {
           searchGraph(match[0]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: 'Error: ' + data.error.message }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Failed to connect to AI: ' + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      {messages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ padding: '20px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', marginBottom: '20px' }}>
            <MessageSquare size={48} color="var(--accent)" />
          </div>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>Apex Think AI</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '400px', lineHeight: '1.6', marginBottom: '40px' }}>
            Ask questions about the code, architecture, or how to get started.
          </p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', maxWidth: '600px' }}>
            <button className="suggestion-chip" onClick={() => handleSend("Explain project structure")}>Explain project structure</button>
            <button className="suggestion-chip" onClick={() => handleSend("Where is authentication handled?")}>Where is authentication?</button>
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
              Thinking...
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
          placeholder="Ask a question..." 
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={loading}>Send</button>
      </div>
    </div>
  );
}
