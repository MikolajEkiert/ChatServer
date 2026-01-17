import { useState } from 'react';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    return sessionStorage.getItem('roomCode') ? 'chat' : 'home';
  });
  const [roomCode, setRoomCode] = useState(() => {
    return sessionStorage.getItem('roomCode') || '';
  });
  const [username, setUsername] = useState(() => {
    return sessionStorage.getItem('username') || '';
  });

  const handleCreateRoom = (newRoomCode, newUsername) => {
    sessionStorage.setItem('roomCode', newRoomCode);
    sessionStorage.setItem('username', newUsername);
    setRoomCode(newRoomCode);
    setUsername(newUsername);
    setCurrentPage('chat');
  };

  const handleJoinRoom = (newRoomCode, newUsername) => {
    sessionStorage.setItem('roomCode', newRoomCode);
    sessionStorage.setItem('username', newUsername);
    setRoomCode(newRoomCode);
    setUsername(newUsername);
    setCurrentPage('chat');
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('username');
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
