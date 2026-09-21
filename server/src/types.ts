export type Loyalty = 'good' | 'evil';

export type SpecialRole = 'merlin' | 'percival' | 'morgana' | 'mordred' | 'oberon' | 'assassin';
export type FillerRole = 'servant' | 'minion';
export type Role = SpecialRole | FillerRole;

export type OptionalRoleKey = 'percival' | 'morgana' | 'mordred' | 'oberon';

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

export interface MissionRecord {
  round: number;
  teamIds: string[];
  success: boolean;
  fails: number;
}

export interface RoundVotes {
  round: number;
  attempt: number;
  teamIds: string[];
  votes: Record<string, boolean>;
}

export interface PublicGameState {
  phase: GamePhase;
  round: number; // 0-indexed current mission
  attempt: number; // rejection attempt count for current round
  leaderId: string | null;
  missionSpecs: MissionSpec[];
  teamProposal: string[];
  missions: Array<{ success: boolean; fails: number } | null>;
  votesSubmitted: string[]; // player ids who have voted this round
  missionActionsSubmitted: string[]; // player ids who have submitted mission action
  lastVoteResult: { approved: boolean; votes: Record<string, boolean> } | null;
  winner: Loyalty | null;
  winReason: string | null;
  assassinId: string | null;
  merlinRevealId: string | null; // revealed only at game over
  allRolesRevealed: Record<string, Role> | null; // revealed only at game over
  goodWins: number;
  evilWins: number;
}

export interface PrivateRoleInfo {
  role: Role;
  loyalty: Loyalty;
  isAssassin: boolean;
  knownEvilIds: string[]; // for evil players (except oberon): other evil teammates
  merlinCandidateIds: string[]; // for percival: ids that could be merlin (merlin + morgana if enabled)
}

export interface RoomSettings {
  percival: boolean;
  morgana: boolean;
  mordred: boolean;
  oberon: boolean;
}
