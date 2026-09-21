import { MissionSpec, RoomSettings } from './types';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

/**
 * Classic "The Resistance: Avalon" mission compositions by player count.
 */
export const MISSION_TABLE: Record<number, MissionSpec[]> = {
  5: [
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
  ],
  6: [
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
  ],
  7: [
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 2 },
    { players: 4, failsRequired: 1 },
  ],
  8: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 5, failsRequired: 2 },
    { players: 5, failsRequired: 1 },
  ],
  9: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 5, failsRequired: 2 },
    { players: 5, failsRequired: 1 },
  ],
  10: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 5, failsRequired: 2 },
    { players: 5, failsRequired: 1 },
  ],
};

export const LOYALTY_COUNT: Record<number, { good: number; evil: number }> = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 },
};

export function defaultSettings(): RoomSettings {
  return { percival: false, morgana: false, mordred: false, oberon: false };
}

/**
 * Optional evil roles (morgana/mordred/oberon) each occupy one evil slot,
 * on top of the always-present assassin. Percival occupies one good slot,
 * on top of the always-present merlin.
 */
export function validateSettings(playerCount: number, settings: RoomSettings): string | null {
  const counts = LOYALTY_COUNT[playerCount];
  if (!counts) return `Unsupported player count: ${playerCount}`;

  const evilSpecialCount = [settings.morgana, settings.mordred, settings.oberon].filter(Boolean).length;
  if (evilSpecialCount > counts.evil - 1) {
    return 'Too many evil special roles for this player count';
  }

  const goodSpecialCount = settings.percival ? 1 : 0;
  if (goodSpecialCount > counts.good - 1) {
    return 'Too many good special roles for this player count';
  }

  return null;
}
