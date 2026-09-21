import './App.css';
import { useGame } from './useGame';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';

function App() {
  const {
    connected,
    room,
    game,
    privateInfo,
    myId,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleSetting,
    startGame,
    playAgain,
    proposeTeam,
    vote,
    missionAction,
    continueGame,
    assassinGuess,
  } = useGame();

  if (!room || !myId) {
    return <Home connected={connected} error={error} onCreate={createRoom} onJoin={joinRoom} />;
  }

  if (room.inGame && game) {
    return (
      <Game
        room={room}
        game={game}
        privateInfo={privateInfo}
        myId={myId}
        error={error}
        onProposeTeam={proposeTeam}
        onVote={vote}
        onMissionAction={missionAction}
        onContinue={continueGame}
        onAssassinGuess={assassinGuess}
        onPlayAgain={playAgain}
        onLeave={leaveRoom}
      />
    );
  }

  return (
    <Lobby room={room} myId={myId} error={error} onToggleSetting={toggleSetting} onStart={startGame} onLeave={leaveRoom} />
  );
}

export default App;
