import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import type { PrivateRoleInfo, PublicGameState, RoomSettings, RoomState } from './types';

type Ack = { ok: true; [key: string]: unknown } | { ok: false; error: string };

const STORAGE_KEY = 'avalon-session';

interface StoredSession {
  roomCode: string;
  playerId: string;
  name: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export function useGame() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<PublicGameState | null>(null);
  const [privateInfo, setPrivateInfo] = useState<PrivateRoleInfo | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rejoinAttempted = useRef(false);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      const session = loadSession();
      if (session && !rejoinAttempted.current) {
        rejoinAttempted.current = true;
        socket.emit('room:rejoin', { roomCode: session.roomCode, playerId: session.playerId }, (res: Ack) => {
          if (res.ok) {
            setMyId(session.playerId);
          } else {
            saveSession(null);
          }
        });
      }
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onRoomState(state: RoomState) {
      setRoom(state);
      if (!state.inGame) {
        setGame(null);
        setPrivateInfo(null);
      }
    }
    function onGamePublic(state: PublicGameState) {
      setGame(state);
    }
    function onGamePrivate(info: PrivateRoleInfo) {
      setPrivateInfo(info);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('game:public', onGamePublic);
    socket.on('game:private', onGamePrivate);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('game:public', onGamePublic);
      socket.off('game:private', onGamePrivate);
    };
  }, []);

  const createRoom = useCallback((name: string) => {
    setError(null);
    socket.emit('room:create', { name }, (res: Ack) => {
      if (res.ok) {
        const roomCode = res.roomCode as string;
        const playerId = res.playerId as string;
        setMyId(playerId);
        saveSession({ roomCode, playerId, name });
      } else {
        setError(res.error);
      }
    });
  }, []);

  const joinRoom = useCallback((roomCode: string, name: string) => {
    setError(null);
    socket.emit('room:join', { roomCode, name }, (res: Ack) => {
      if (res.ok) {
        const code = res.roomCode as string;
        const playerId = res.playerId as string;
        setMyId(playerId);
        saveSession({ roomCode: code, playerId, name });
      } else {
        setError(res.error);
      }
    });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('room:leave');
    saveSession(null);
    setRoom(null);
    setGame(null);
    setPrivateInfo(null);
    setMyId(null);
  }, []);

  function actionWithError<T extends object>(event: string, payload?: T) {
    setError(null);
    socket.emit(event, payload ?? {}, (res: Ack) => {
      if (!res.ok) setError(res.error);
    });
  }

  const toggleSetting = useCallback((key: keyof RoomSettings, value: boolean) => {
    actionWithError('room:toggleSetting', { key, value });
  }, []);

  const startGame = useCallback(() => actionWithError('room:start'), []);
  const playAgain = useCallback(() => actionWithError('room:playAgain'), []);
  const proposeTeam = useCallback((teamIds: string[]) => actionWithError('game:proposeTeam', { teamIds }), []);
  const vote = useCallback((approve: boolean) => actionWithError('game:vote', { approve }), []);
  const missionAction = useCallback((success: boolean) => actionWithError('game:missionAction', { success }), []);
  const continueGame = useCallback(() => actionWithError('game:continue'), []);
  const assassinGuess = useCallback((targetId: string) => actionWithError('game:assassinGuess', { targetId }), []);

  return {
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
  };
}
