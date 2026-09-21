import { Player, RoomSettings } from './types';
import { AvalonGame } from './game';
import { defaultSettings, MIN_PLAYERS, MAX_PLAYERS, validateSettings } from './rules';

export class Room {
  readonly code: string;
  hostId: string;
  players: Player[] = [];
  settings: RoomSettings = defaultSettings();
  game: AvalonGame | null = null;

  constructor(code: string, hostId: string) {
    this.code = code;
    this.hostId = hostId;
  }

  addPlayer(player: Player): string | null {
    if (this.game) return 'Game already in progress';
    if (this.players.length >= MAX_PLAYERS) return 'Room is full';
    if (this.players.some((p) => p.name.toLowerCase() === player.name.toLowerCase())) {
      return 'Name already taken in this room';
    }
    this.players.push(player);
    return null;
  }

  removePlayer(playerId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;
    if (this.game) {
      // Keep them in the game roster but mark disconnected so the game can continue.
      player.connected = false;
    } else {
      this.players = this.players.filter((p) => p.id !== playerId);
      if (this.hostId === playerId && this.players.length > 0) {
        this.hostId = this.players[0].id;
      }
    }
  }

  isEmpty(): boolean {
    return this.players.every((p) => !p.connected);
  }

  canStart(): string | null {
    if (this.game) return 'Game already started';
    if (this.players.length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players`;
    if (this.players.length > MAX_PLAYERS) return `Cannot have more than ${MAX_PLAYERS} players`;
    return validateSettings(this.players.length, this.settings);
  }

  startGame(): string | null {
    const err = this.canStart();
    if (err) return err;
    this.game = new AvalonGame(this.players, this.settings);
    return null;
  }

  resetToLobby() {
    this.game = null;
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId: string): Room {
    const code = this.generateCode();
    const room = new Room(code, hostId);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  deleteRoom(code: string) {
    this.rooms.delete(code);
  }

  cleanupEmptyRooms() {
    for (const [code, room] of this.rooms.entries()) {
      if (room.isEmpty()) this.rooms.delete(code);
    }
  }
}
