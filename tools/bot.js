/**
 * Fills a room with passive bot players for manual testing.
 *
 * Usage:
 *   node tools/bot.js <ROOM_CODE> [count] [namePrefix] [serverUrl]
 *
 * Example:
 *   node tools/bot.js ABCD 3
 *   node tools/bot.js ABCD 4 Bot http://172.27.201.75:4000
 *
 * Bots always approve team proposals, always play "success" on missions
 * (even if evil), and pick a naive team when they happen to be leader.
 * Press Ctrl+C to disconnect all bots.
 */
const { io } = require('../web/node_modules/socket.io-client');

const roomCode = process.argv[2];
const count = Number(process.argv[3] || 1);
const namePrefix = process.argv[4] || 'Bot';
const serverUrl = process.argv[5] || 'http://localhost:4000';

if (!roomCode) {
  console.error('Usage: node tools/bot.js <ROOM_CODE> [count] [namePrefix] [serverUrl]');
  process.exit(1);
}

function emit(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res) => resolve(res));
  });
}

async function startBot(name) {
  const socket = io(serverUrl, { transports: ['websocket', 'polling'] });
  let myId = null;
  let players = [];
  const acted = new Set(); // dedupe actions per (phase, round, attempt)

  await new Promise((resolve) => socket.on('connect', resolve));

  const joinRes = await emit(socket, 'room:join', { roomCode, name });
  if (!joinRes.ok) {
    console.error(`[${name}] failed to join: ${joinRes.error}`);
    socket.close();
    return;
  }
  myId = joinRes.playerId;
  console.log(`[${name}] joined room ${roomCode} as ${myId.slice(0, 8)}`);

  socket.on('room:state', (state) => {
    players = state.players;
  });

  socket.on('game:public', async (state) => {
    const tag = `${state.phase}:${state.round}:${state.attempt}`;

    if (state.phase === 'teamBuilding' && state.leaderId === myId && !acted.has(tag)) {
      acted.add(tag);
      const spec = state.missionSpecs[state.round];
      const ids = players.map((p) => p.id);
      const team = ids.slice(0, spec.players);
      const res = await emit(socket, 'game:proposeTeam', { teamIds: team });
      console.log(`[${name}] (leader) proposed team:`, res.ok ? 'ok' : res.error);
    }

    if (state.phase === 'voting' && !state.votesSubmitted.includes(myId) && !acted.has(tag)) {
      acted.add(tag);
      await emit(socket, 'game:vote', { approve: true });
      console.log(`[${name}] approved the team`);
    }

    if (
      state.phase === 'onMission' &&
      state.teamProposal.includes(myId) &&
      !state.missionActionsSubmitted.includes(myId) &&
      !acted.has(tag)
    ) {
      acted.add(tag);
      await emit(socket, 'game:missionAction', { success: true });
      console.log(`[${name}] played success on the mission`);
    }
  });

  socket.on('disconnect', () => console.log(`[${name}] disconnected`));

  return socket;
}

async function main() {
  const sockets = [];
  for (let i = 1; i <= count; i++) {
    const s = await startBot(`${namePrefix}${i}`);
    if (s) sockets.push(s);
  }

  console.log(`\n${sockets.length} bot(s) active in room ${roomCode}. Ctrl+C to stop.`);

  process.on('SIGINT', () => {
    sockets.forEach((s) => s.close());
    process.exit(0);
  });
}

main();
