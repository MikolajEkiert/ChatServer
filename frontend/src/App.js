import { useState } from 'react';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');

  const handleCreateRoom = (newRoomCode, newUsername) => {
    setRoomCode(newRoomCode);
    setUsername(newUsername);
    setCurrentPage('chat');
  };

  const handleJoinRoom = (newRoomCode, newUsername) => {
    setRoomCode(newRoomCode);
    setUsername(newUsername);
    setCurrentPage('chat');
  };

  const handleLeaveRoom = () => {
    setCurrentPage('home');
    setRoomCode('');
    setUsername('');
  };

  return (
    <div className="App">
      {currentPage === 'home' ? (
        <HomePage 
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
        />
      ) : (
        <ChatPage 
          roomCode={roomCode}
          username={username}
          onLeave={handleLeaveRoom}
        />
      )}
    </div>
  );
}

export default App;
