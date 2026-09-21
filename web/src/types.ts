export type Loyalty = 'good' | 'evil';

export type SpecialRole = 'merlin' | 'percival' | 'morgana' | 'mordred' | 'oberon' | 'assassin';
export type FillerRole = 'servant' | 'minion';
export type Role = SpecialRole | FillerRole;

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}

export interface MissionSpec {
  players: number;
  failsRequired: number;
}

export type GamePhase =
  | 'lobby'
  | 'teamBuilding'
  | 'voting'
  | 'onMission'
  | 'missionResult'
  | 'assassin'
  | 'gameOver';

export interface PublicGameState {
  phase: GamePhase;
  round: number;
  attempt: number;
  leaderId: string | null;
  missionSpecs: MissionSpec[];
  teamProposal: string[];
  missions: Array<{ success: boolean; fails: number } | null>;
  votesSubmitted: string[];
  missionActionsSubmitted: string[];
  lastVoteResult: { approved: boolean; votes: Record<string, boolean> } | null;
  winner: Loyalty | null;
  winReason: string | null;
  assassinId: string | null;
  merlinRevealId: string | null;
  allRolesRevealed: Record<string, Role> | null;
  goodWins: number;
  evilWins: number;
}

export interface PrivateRoleInfo {
  role: Role;
  loyalty: Loyalty;
  isAssassin: boolean;
  knownEvilIds: string[];
  merlinCandidateIds: string[];
}

export interface RoomSettings {
  percival: boolean;
  morgana: boolean;
  mordred: boolean;
  oberon: boolean;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  inGame: boolean;
}
