import { useState, useEffect, useRef } from 'react';
import './ChatPage.css';

const AVATAR_COLORS = [
  ['#6366f1', '#4f46e5'],
  ['#06b6d4', '#0891b2'],
  ['#10b981', '#059669'],
  ['#f59e0b', '#d97706'],
  ['#ec4899', '#db2777'],
  ['#8b5cf6', '#7c3aed'],
  ['#14b8a6', '#0d9488'],
];

function getAvatarStyle(name) {
  if (!name) return { background: 'linear-gradient(135deg, #6366f1, #4f46e5)' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  const [c1, c2] = AVATAR_COLORS[index];
  return { background: `linear-gradient(135deg, ${c1}, ${c2})` };
}

function ChatPage({ roomCode, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomCode}/messages`);
        if (response.ok) {
          const history = await response.json();
          setMessages(history);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    fetchHistory();
  }, [roomCode]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '3000'
      ? `${window.location.hostname}:8080`
      : window.location.host;

    const wsUrl = `${protocol}//${host}/ws?room=${encodeURIComponent(roomCode)}&username=${encodeURIComponent(username)}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setMessages((prev) => {
          if (!prev.some((msg) => msg.timestamp === message.timestamp && msg.username === message.username && msg.message === message.message)) {
            return [...prev, message];
          }
          return prev;
        });
      } catch (err) {
        console.error('Error parsing message:', err);
        setMessages(prev => [...prev, {
          username: 'System',
          message: event.data,
          timestamp: new Date().toISOString()
        }]);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomCode, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      username: username,
      message: messageInput.trim(),
      timestamp: new Date().toISOString(),
      roomCode: roomCode
    };

    socket.send(JSON.stringify(message));
    setMessageInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="chat-layout">
      <header className="chat-navbar">
        <div className="nav-left">
          <div className="room-badge" onClick={copyRoomCode} title="Click to copy room code">
            <span className="room-label">ROOM</span>
            <span className="room-code-val">{roomCode}</span>
            <span className="copy-icon">
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </span>
            {copied && <span className="copy-tooltip">Copied!</span>}
          </div>
        </div>

        <div className="nav-center">
          {!isConnected && (
            <div className="status-pill offline">
              <span className="status-indicator"></span>
              <span className="status-text">OFFLINE</span>
            </div>
          )}
        </div>

        <div className="nav-right">
          <div className="user-profile">
            <div className="user-avatar-sm" style={getAvatarStyle(username)}>
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="user-name">{username}</span>
          </div>
          <button onClick={onLeave} className="leave-action-btn" title="Leave chat room">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Exit</span>
          </button>
        </div>
      </header>

      <main className="chat-body">
        <div className="messages-stream">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3>No messages yet</h3>
              <p>Be the first to say hello in room <code>#{roomCode}</code></p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOwn = msg.username === username;
              const isSystem = msg.username === 'System';

              if (isSystem) {
                return (
                  <div key={index} className="system-message">
                    <span>{msg.message}</span>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className={`message-row ${isOwn ? 'own-row' : ''}`}
                >
                  {!isOwn && (
                    <div className="msg-avatar" style={getAvatarStyle(msg.username)}>
                      {msg.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="msg-bubble-wrap">
                    <div className="msg-meta">
                      <span className="msg-author">{isOwn ? 'You' : msg.username}</span>
                      <span className="msg-timestamp">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="msg-content">
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="chat-composer-wrap">
        <div className="chat-composer">
          <input
            type="text"
            className="composer-input"
            placeholder={isConnected ? `Message #${roomCode}...` : 'Connecting to cluster...'}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            autoFocus
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !messageInput.trim()}
            className="composer-send-btn"
            title="Send message (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}

export default ChatPage;
