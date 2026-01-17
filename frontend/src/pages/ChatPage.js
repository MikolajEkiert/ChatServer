import { useState, useEffect, useRef } from 'react';
import './ChatPage.css';

function ChatPage({ roomCode, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
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
      
    const wsUrl = `${protocol}//${host}/ws?room=${roomCode}&username=${encodeURIComponent(username)}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setMessages((prev) => {
          if (!prev.some((msg) => msg.timestamp === message.timestamp && msg.username === message.username)) {
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
      if (ws.readyState === WebSocket.OPEN) {
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <div className="room-info">
            <h2>Room: {roomCode}</h2>
            <button onClick={copyRoomCode} className="copy-btn" title="Copy room code">
              📋
            </button>
          </div>
          <div className="user-info">
            <span>You: {username}</span>
            <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
          <button onClick={onLeave} className="leave-btn">
            Leave Room
          </button>
        </div>

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={index} 
                className={`message ${msg.username === username ? 'own-message' : ''}`}
              >
                <div className="message-header">
                  <span className="message-username">{msg.username}</span>
                  <p>{' '}</p>
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="message-content">{msg.message}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <input
            type="text"
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected}
            className="message-input"
          />
          <button 
            onClick={handleSendMessage}
            disabled={!isConnected || !messageInput.trim()}
            className="send-btn"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;

