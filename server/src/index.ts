import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import path from 'path';

import { RoomManager, Room } from './room';
import { RoomSettings } from './types';

const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const rooms = new RoomManager();

// socket.id -> { roomCode, playerId }
const socketMembership = new Map<string, { roomCode: string; playerId: string }>();
// playerId -> current socket.id (for private messages / to know who's "live")
const playerSockets = new Map<string, string>();

type ErrAck = (res: { ok: false; error: string }) => void;
// eslint-disable-next-line @typescript-eslint/ban-types
type Callback<T extends object = {}> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

function broadcastRoom(room: Room) {
  io.to(room.code).emit('room:state', {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
    settings: room.settings,
    inGame: !!room.game,
  });

  if (room.game) {
    io.to(room.code).emit('game:public', room.game.getPublicState());
  }
}

function sendPrivateInfo(room: Room, playerId: string) {
  if (!room.game) return;
  const socketId = playerSockets.get(playerId);
  if (!socketId) return;
  const info = room.game.getPrivateInfo(playerId);
  io.to(socketId).emit('game:private', info);
}

function sendPrivateInfoToAll(room: Room) {
  for (const p of room.players) sendPrivateInfo(room, p.id);
}

io.on('connection', (socket: Socket) => {
  socket.on('room:create', (data: { name: string }, cb: Callback<{ roomCode: string; playerId: string }>) => {
    const name = (data?.name || '').trim().slice(0, 20);
    if (!name) return cb({ ok: false, error: 'Name is required' });

    const playerId = randomUUID();
    const room = rooms.createRoom(playerId);
    room.addPlayer({ id: playerId, name, connected: true });

    socket.join(room.code);
    socketMembership.set(socket.id, { roomCode: room.code, playerId });
    playerSockets.set(playerId, socket.id);

    cb({ ok: true, roomCode: room.code, playerId });
    broadcastRoom(room);
  });

  socket.on(
    'room:join',
    (data: { roomCode: string; name: string }, cb: Callback<{ roomCode: string; playerId: string }>) => {
      const room = rooms.getRoom((data?.roomCode || '').trim());
      if (!room) return cb({ ok: false, error: 'Room not found' });

      const name = (data?.name || '').trim().slice(0, 20);
      if (!name) return cb({ ok: false, error: 'Name is required' });

      const playerId = randomUUID();
      const err = room.addPlayer({ id: playerId, name, connected: true });
      if (err) return cb({ ok: false, error: err });

      socket.join(room.code);
      socketMembership.set(socket.id, { roomCode: room.code, playerId });
      playerSockets.set(playerId, socket.id);

      cb({ ok: true, roomCode: room.code, playerId });
      broadcastRoom(room);
    },
  );

  socket.on(
    'room:rejoin',
    (data: { roomCode: string; playerId: string }, cb: Callback) => {
      const room = rooms.getRoom((data?.roomCode || '').trim());
      if (!room) return cb({ ok: false, error: 'Room not found' });
      const player = room.players.find((p) => p.id === data.playerId);
      if (!player) return cb({ ok: false, error: 'Player not found in room' });

      player.connected = true;
      socket.join(room.code);
      socketMembership.set(socket.id, { roomCode: room.code, playerId: player.id });
      playerSockets.set(player.id, socket.id);

      cb({ ok: true });
      broadcastRoom(room);
      sendPrivateInfo(room, player.id);
    },
  );

  function withRoom(cb: ErrAck, fn: (room: Room, playerId: string) => void) {
    const membership = socketMembership.get(socket.id);
    if (!membership) return cb({ ok: false, error: 'Not in a room' });
    const room = rooms.getRoom(membership.roomCode);
    if (!room) return cb({ ok: false, error: 'Room no longer exists' });
    fn(room, membership.playerId);
  }

  socket.on('room:toggleSetting', (data: { key: keyof RoomSettings; value: boolean }, cb: Callback) => {
    withRoom(cb as ErrAck, (room, playerId) => {
      if (room.hostId !== playerId) return cb({ ok: false, error: 'Only the host can change settings' });
      if (room.game) return cb({ ok: false, error: 'Cannot change settings during a game' });
      room.settings = { ...room.settings, [data.key]: data.value };
      cb({ ok: true });
      broadcastRoom(room);
    });
  });

  socket.on('room:start', (_data: unknown, cb: Callback) => {
    withRoom(cb as ErrAck, (room, playerId) => {
      if (room.hostId !== playerId) return cb({ ok: false, error: 'Only the host can start the game' });
      const err = room.startGame();
      if (err) return cb({ ok: false, error: err });
      cb({ ok: true });
      broadcastRoom(room);
      sendPrivateInfoToAll(room);
    });
  });

  socket.on('room:playAgain', (_data: unknown, cb: Callback) => {
    withRoom(cb as ErrAck, (room, playerId) => {
      if (room.hostId !== playerId) return cb({ ok: false, error: 'Only the host can restart' });
      room.resetToLobby();
      cb({ ok: true });
      broadcastRoom(room);
    });
  });

  socket.on('game:proposeTeam', (data: { teamIds: string[] }, cb: Callback) => {
    withRoom(cb as ErrAck, (room, playerId) => {
      if (!room.game) return cb({ ok: false, error: 'No game in progress' });
      const err = room.game.proposeTeam(playerId, data.teamIds || []);
      if (err) return cb({ ok: false, error: err });
      cb({ ok: true });
      broadcastRoom(room);
    });
  });

  socket.on('game:vote', (data: { approve: boolean }, cb: Callback) => {
    withRoom(cb as ErrAck, (room, playerId) => {
      if (!room.game) return cb({ ok: false, error: 'No game in progress' });
      const err = room.game.submitVote(playerId, !!data.approve);
      if (err) return cb({ ok: false, error: err });
      cb({ ok: true });
      broadcastRoom(room);
    });
  });

  socket.on('game:missionAction', (data: { success: boolean }, cb: Callback) => {
    withRoom(cb as ErrAck, (room, playerId) => {
      if (!room.game) return cb({ ok: false, error: 'No game in progress' });
      const err = room.game.submitMissionAction(playerId, !!data.success);
      if (err) return cb({ ok: false, error: err });
      cb({ ok: true });
      broadcastRoom(room);
    });
  });

  socket.on('game:continue', (_data: unknown, cb: Callback) => {
    withRoom(cb as ErrAck, (room) => {
      if (!room.game) return cb({ ok: false, error: 'No game in progress' });
      room.game.advanceAfterMissionResult();
      cb({ ok: true });
      broadcastRoom(room);
    });
  });

  socket.on('game:assassinGuess', (data: { targetId: string }, cb: Callback) => {
    withRoom(cb as ErrAck, (room, playerId) => {
      if (!room.game) return cb({ ok: false, error: 'No game in progress' });
      const err = room.game.submitAssassinGuess(playerId, data.targetId);
      if (err) return cb({ ok: false, error: err });
      cb({ ok: true });
      broadcastRoom(room);
    });
  });

  socket.on('room:leave', () => {
    handleDisconnect(socket);
  });

  socket.on('disconnect', () => {
    handleDisconnect(socket);
  });

  function handleDisconnect(s: Socket) {
    const membership = socketMembership.get(s.id);
    if (!membership) return;
    socketMembership.delete(s.id);

    const room = rooms.getRoom(membership.roomCode);
    if (!room) return;

    if (playerSockets.get(membership.playerId) === s.id) {
      playerSockets.delete(membership.playerId);
    }

    room.removePlayer(membership.playerId);

    if (room.isEmpty() || room.players.length === 0) {
      rooms.deleteRoom(room.code);
      return;
    }

    broadcastRoom(room);
  }
});

const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
app.use(express.static(webDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Avalon server listening on http://localhost:${PORT}`);
});
