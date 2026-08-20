import { useState } from 'react';
import './HomePage.css';

function HomePage({ onJoinRoom, onCreateRoom }) {
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    setIsCreating(true);
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
      onCreateRoom(data.roomCode, username);
    } catch (err) {
      setError(err.message || 'Failed to create room');
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim() || !username.trim()) {
      setError('Please enter both room code and username');
      return;
    }

    setError('');

    try {
      const response = await fetch(`/api/rooms/${roomCode}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Room not found');
        } else {
          throw new Error('Failed to verify room');
        }
        return;
      }

      onJoinRoom(roomCode, username);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    }
  };

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <h1>💬 Chat Server</h1>
        <p className="subtitle">Create or join a chat room</p>

        {error && <div className="error-message">{error}</div>}

        <div className="form-section">
          <h2>Create New Room</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleCreateRoom)}
              maxLength={20}
            />
            <button 
              onClick={handleCreateRoom} 
              disabled={isCreating}
              className="create-btn"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="form-section">
          <h2>Join Existing Room</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="Room code (e.g., ABC123)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => handleKeyDown(e, handleJoinRoom)}
              maxLength={6}
              style={{ textTransform: 'uppercase' }}
            />
            <input
              type="text"
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleJoinRoom)}
              maxLength={20}
            />
            <button onClick={handleJoinRoom} className="join-btn">
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
