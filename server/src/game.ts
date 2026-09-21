import {
  Player,
  Role,
  Loyalty,
  GamePhase,
  RoomSettings,
  PublicGameState,
  PrivateRoleInfo,
  MissionSpec,
} from './types';
import { MISSION_TABLE, LOYALTY_COUNT } from './rules';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface RoleAssignment {
  role: Role;
  loyalty: Loyalty;
}

export class AvalonGame {
  readonly players: Player[];
  readonly settings: RoomSettings;
  readonly missionSpecs: MissionSpec[];

  private roles = new Map<string, RoleAssignment>();
  private privateInfo = new Map<string, PrivateRoleInfo>();

  phase: GamePhase = 'teamBuilding';
  round = 0;
  attempt = 0;
  leaderIndex = 0;
  teamProposal: string[] = [];
  votes: Record<string, boolean> = {};
  missionActions: Record<string, boolean> = {};
  missions: Array<{ success: boolean; fails: number } | null>;
  lastVoteResult: { approved: boolean; votes: Record<string, boolean> } | null = null;
  winner: Loyalty | null = null;
  winReason: string | null = null;
  assassinId: string | null = null;
  merlinId: string | null = null;

  private pendingAfterMissionResult: 'assassin' | 'teamBuilding' | null = null;
  private pendingGameOver: { winner: Loyalty; reason: string } | null = null;

  constructor(players: Player[], settings: RoomSettings) {
    this.players = players;
    this.settings = settings;
    this.missionSpecs = MISSION_TABLE[players.length];
    this.missions = this.missionSpecs.map(() => null);
    this.assignRoles();
    this.leaderIndex = Math.floor(Math.random() * players.length);
  }

  private assignRoles() {
    const counts = LOYALTY_COUNT[this.players.length];
    const shuffled = shuffle(this.players);

    const evilIds = shuffled.slice(0, counts.evil).map((p) => p.id);
    const goodIds = shuffled.slice(counts.evil).map((p) => p.id);

    const evilSpecials: Array<{ id: string; role: Role }> = [];
    let evilPool = [...evilIds];

    // assassin is always present among evil
    const assassinId = evilPool.shift()!;
    evilSpecials.push({ id: assassinId, role: 'assassin' });
    this.assassinId = assassinId;

    if (this.settings.morgana) evilSpecials.push({ id: evilPool.shift()!, role: 'morgana' });
    if (this.settings.mordred) evilSpecials.push({ id: evilPool.shift()!, role: 'mordred' });
    if (this.settings.oberon) evilSpecials.push({ id: evilPool.shift()!, role: 'oberon' });

    const evilRoleMap = new Map<string, Role>();
    evilSpecials.forEach((e) => evilRoleMap.set(e.id, e.role));
    evilPool.forEach((id) => evilRoleMap.set(id, 'minion'));

    let goodPool = [...goodIds];
    const merlinId = goodPool.shift()!;
    this.merlinId = merlinId;
    const goodRoleMap = new Map<string, Role>();
    goodRoleMap.set(merlinId, 'merlin');
    if (this.settings.percival) goodRoleMap.set(goodPool.shift()!, 'percival');
    goodPool.forEach((id) => goodRoleMap.set(id, 'servant'));

    for (const id of evilIds) this.roles.set(id, { role: evilRoleMap.get(id)!, loyalty: 'evil' });
    for (const id of goodIds) this.roles.set(id, { role: goodRoleMap.get(id)!, loyalty: 'good' });

    // Evil players (except oberon) know each other.
    const nonOberonEvilIds = evilIds.filter((id) => this.roles.get(id)!.role !== 'oberon');

    // Merlin sees all evil, except mordred if mordred is enabled.
    const merlinVisibleEvilIds = evilIds.filter((id) => this.roles.get(id)!.role !== 'mordred');

    // Percival sees merlin, plus morgana if enabled (indistinguishable from merlin).
    const merlinCandidateIds = this.settings.morgana
      ? shuffle([merlinId, evilIds.find((id) => this.roles.get(id)!.role === 'morgana')!])
      : [merlinId];

    for (const player of this.players) {
      const assignment = this.roles.get(player.id)!;
      const info: PrivateRoleInfo = {
        role: assignment.role,
        loyalty: assignment.loyalty,
        isAssassin: assignment.role === 'assassin',
        knownEvilIds: [],
        merlinCandidateIds: [],
      };

      if (assignment.loyalty === 'evil' && assignment.role !== 'oberon') {
        info.knownEvilIds = nonOberonEvilIds.filter((id) => id !== player.id);
      }

      if (assignment.role === 'merlin') {
        info.knownEvilIds = merlinVisibleEvilIds;
      }

      if (assignment.role === 'percival') {
        info.merlinCandidateIds = merlinCandidateIds;
      }

      this.privateInfo.set(player.id, info);
    }
  }

  getPrivateInfo(playerId: string): PrivateRoleInfo | null {
    return this.privateInfo.get(playerId) ?? null;
  }

  private currentLeaderId(): string {
    return this.players[this.leaderIndex % this.players.length].id;
  }

  private advanceLeader() {
    this.leaderIndex = (this.leaderIndex + 1) % this.players.length;
  }

  proposeTeam(playerId: string, teamIds: string[]): string | null {
    if (this.phase !== 'teamBuilding') return 'Not in team building phase';
    if (playerId !== this.currentLeaderId()) return 'Only the leader can propose a team';
    const spec = this.missionSpecs[this.round];
    if (teamIds.length !== spec.players) return `Team must have exactly ${spec.players} players`;
    const validIds = new Set(this.players.map((p) => p.id));
    if (!teamIds.every((id) => validIds.has(id)) || new Set(teamIds).size !== teamIds.length) {
      return 'Invalid team';
    }

    this.teamProposal = teamIds;
    this.votes = {};
    this.phase = 'voting';
    return null;
  }

  submitVote(playerId: string, approve: boolean): string | null {
    if (this.phase !== 'voting') return 'Not in voting phase';
    if (!this.players.some((p) => p.id === playerId)) return 'Unknown player';
    if (playerId in this.votes) return 'Already voted';

    this.votes[playerId] = approve;

    if (Object.keys(this.votes).length === this.players.length) {
      this.resolveVote();
    }
    return null;
  }

  private resolveVote() {
    const approvals = Object.values(this.votes).filter(Boolean).length;
    const approved = approvals > this.players.length / 2;
    this.lastVoteResult = { approved, votes: { ...this.votes } };
    this.advanceLeader();

    if (approved) {
      this.phase = 'onMission';
      this.missionActions = {};
    } else {
      this.attempt += 1;
      if (this.attempt >= 5) {
        this.finishGame('evil', 'Five consecutive team proposals were rejected');
        return;
      }
      this.teamProposal = [];
      this.phase = 'teamBuilding';
    }
  }

  submitMissionAction(playerId: string, success: boolean): string | null {
    if (this.phase !== 'onMission') return 'Not on a mission';
    if (!this.teamProposal.includes(playerId)) return 'Player is not on the mission team';
    if (playerId in this.missionActions) return 'Already submitted';

    const assignment = this.roles.get(playerId)!;
    // Good-aligned players may only ever play success.
    const action = assignment.loyalty === 'good' ? true : success;
    this.missionActions[playerId] = action;

    if (Object.keys(this.missionActions).length === this.teamProposal.length) {
      this.resolveMission();
    }
    return null;
  }

  private resolveMission() {
    const spec = this.missionSpecs[this.round];
    const fails = Object.values(this.missionActions).filter((a) => a === false).length;
    const success = fails < spec.failsRequired;
    this.missions[this.round] = { success, fails };
    this.phase = 'missionResult';

    const successes = this.missions.filter((m) => m?.success).length;
    const failures = this.missions.filter((m) => m && !m.success).length;

    if (failures >= 3) {
      this.pendingGameOver = { winner: 'evil', reason: 'Evil sabotaged three missions' };
      this.pendingAfterMissionResult = null;
    } else if (successes >= 3) {
      this.pendingAfterMissionResult = 'assassin';
    } else {
      this.pendingAfterMissionResult = 'teamBuilding';
    }
  }

  /** Called once players have seen the mission outcome, to move to the next phase. */
  advanceAfterMissionResult(): string | null {
    if (this.phase !== 'missionResult') return 'Not showing a mission result';

    if (this.pendingGameOver) {
      this.finishGame(this.pendingGameOver.winner, this.pendingGameOver.reason);
      this.pendingGameOver = null;
      return null;
    }

    if (this.pendingAfterMissionResult === 'assassin') {
      this.phase = 'assassin';
    } else {
      this.round += 1;
      this.attempt = 0;
      this.teamProposal = [];
      this.phase = 'teamBuilding';
    }
    this.pendingAfterMissionResult = null;
    return null;
  }

  submitAssassinGuess(playerId: string, targetId: string): string | null {
    if (this.phase !== 'assassin') return 'Not in assassin phase';
    if (playerId !== this.assassinId) return 'Only the assassin may guess';
    if (targetId === this.merlinId) {
      this.finishGame('evil', 'The assassin correctly identified Merlin');
    } else {
      this.finishGame('good', 'The assassin failed to identify Merlin');
    }
    return null;
  }

  private finishGame(winner: Loyalty, reason: string) {
    this.winner = winner;
    this.winReason = reason;
    this.phase = 'gameOver';
  }

  getPublicState(): PublicGameState {
    const gameOver = this.phase === 'gameOver';
    const allRoles: Record<string, Role> = {};
    if (gameOver) {
      for (const [id, a] of this.roles.entries()) allRoles[id] = a.role;
    }

    return {
      phase: this.phase,
      round: this.round,
      attempt: this.attempt,
      leaderId: this.currentLeaderId(),
      missionSpecs: this.missionSpecs,
      teamProposal: this.teamProposal,
      missions: this.missions,
      votesSubmitted: Object.keys(this.votes),
      missionActionsSubmitted: Object.keys(this.missionActions),
      lastVoteResult: this.lastVoteResult,
      winner: this.winner,
      winReason: this.winReason,
      assassinId: gameOver ? this.assassinId : this.phase === 'assassin' ? this.assassinId : null,
      merlinRevealId: gameOver ? this.merlinId : null,
      allRolesRevealed: gameOver ? allRoles : null,
      goodWins: this.missions.filter((m) => m?.success).length,
      evilWins: this.missions.filter((m) => m && !m.success).length,
    };
  }
}
