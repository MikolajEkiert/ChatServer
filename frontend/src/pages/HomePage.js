import { useState } from 'react';
import './HomePage.css';

function HomePage({ onJoinRoom, onCreateRoom }) {
  const [activeTab, setActiveTab] = useState('create');
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      onCreateRoom(data.roomCode, username.trim());
    } catch (err) {
      setError(err.message || 'Failed to create room');
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim() || !username.trim()) {
      setError('Please enter both room code and username');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const normalizedCode = roomCode.trim().toUpperCase();
      const response = await fetch(`/api/rooms/${normalizedCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Room not found. Check code or create a new room.');
        } else {
          throw new Error('Failed to verify room');
        }
        setIsSubmitting(false);
        return;
      }

      onJoinRoom(normalizedCode, username.trim());
    } catch (err) {
      setError(err.message || 'Failed to join room');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  return (
    <div className="home-wrapper">
      <div className="home-card">
        <div className="brand-header">

          <h1 className="brand-title">ChatServer</h1>
          <p className="brand-subtitle">
            Zero-latency chat rooms synchronized via Redis Pub/Sub cluster.
          </p>
        </div>

        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('create');
              setError('');
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Create Room
          </button>
          <button
            className={`tab-button ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('join');
              setError('');
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            Join Room
          </button>
        </div>

        {error && (
          <div className="alert-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'create' ? (
          <div className="tab-pane">
            <div className="field-group">
              <label className="field-label" htmlFor="create-username">Username</label>
              <input
                id="create-username"
                className="text-input"
                type="text"
                placeholder="e.g. alex_dev"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleCreateRoom)}
                maxLength={24}
                autoFocus
              />
            </div>

            <button
              className="primary-button"
              onClick={handleCreateRoom}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-loading">
                  <span className="spinner"></span>
                  Creating Room...
                </span>
              ) : (
                <>
                  <span>Create Room</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="tab-pane">
            <div className="field-group">
              <label className="field-label" htmlFor="join-room">Room Code</label>
              <input
                id="join-room"
                className="text-input mono-input"
                type="text"
                placeholder="e.g. AB12CD"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => handleKeyDown(e, handleJoinRoom)}
                maxLength={8}
                autoFocus
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="join-username">Username</label>
              <input
                id="join-username"
                className="text-input"
                type="text"
                placeholder="e.g. alex_dev"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleJoinRoom)}
                maxLength={24}
              />
            </div>

            <button
              className="primary-button"
              onClick={handleJoinRoom}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-loading">
                  <span className="spinner"></span>
                  Connecting...
                </span>
              ) : (
                <>
                  <span>Enter Room</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>
          </div>
        )}

        <div className="card-footer">
          <span>End-to-End WebSocket Stream • Instant Sync</span>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
