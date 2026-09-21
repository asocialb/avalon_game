import { useState } from 'react';
import type { Player, PrivateRoleInfo, PublicGameState, RoomState } from '../types';
import { MissionTrack } from './MissionTrack';
import { RolePanel } from './RolePanel';

const ROLE_LABELS: Record<string, string> = {
  merlin: 'Мерлин',
  percival: 'Персиваль',
  morgana: 'Моргана',
  mordred: 'Мордред',
  oberon: 'Оберон',
  assassin: 'Ассасин',
  servant: 'Слуга Артура',
  minion: 'Приспешник Мордреда',
};

function nameOf(players: Player[], id: string | null) {
  if (!id) return '???';
  return players.find((p) => p.id === id)?.name ?? '???';
}

interface Props {
  room: RoomState;
  game: PublicGameState;
  privateInfo: PrivateRoleInfo | null;
  myId: string;
  error: string | null;
  onProposeTeam: (teamIds: string[]) => void;
  onVote: (approve: boolean) => void;
  onMissionAction: (success: boolean) => void;
  onContinue: () => void;
  onAssassinGuess: (targetId: string) => void;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function Game({
  room,
  game,
  privateInfo,
  myId,
  error,
  onProposeTeam,
  onVote,
  onMissionAction,
  onContinue,
  onAssassinGuess,
  onPlayAgain,
  onLeave,
}: Props) {
  const { players, hostId } = room;
  const spec = game.missionSpecs[game.round];
  const isLeader = game.leaderId === myId;
  const isHost = hostId === myId;
  const [selected, setSelected] = useState<string[]>([]);
  const [assassinTarget, setAssassinTarget] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= spec.players) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="screen game">
      <div className="game-header">
        <span>
          Комната <strong>{room.code}</strong>
        </span>
        <span>
          Успехи: {game.goodWins} / Провалы: {game.evilWins}
        </span>
      </div>

      <MissionTrack missionSpecs={game.missionSpecs} missions={game.missions} round={game.round} />

      {privateInfo && <RolePanel info={privateInfo} players={players} />}

      {error && <p className="error">{error}</p>}

      {game.phase === 'teamBuilding' && (
        <div className="panel">
          {game.lastVoteResult && !game.lastVoteResult.approved && (
            <p className="hint">
              Предыдущее предложение отклонено ({Object.values(game.lastVoteResult.votes).filter(Boolean).length}
              /{players.length} за). Попытка {game.attempt + 1}/5.
            </p>
          )}
          <h3>
            Лидер: <strong>{nameOf(players, game.leaderId)}</strong> выбирает {spec.players} игрока(ов)
          </h3>
          {isLeader ? (
            <>
              <ul className="player-picker">
                {players.map((p) => (
                  <li key={p.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                      {p.name}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                className="btn primary"
                disabled={selected.length !== spec.players}
                onClick={() => onProposeTeam(selected)}
              >
                Предложить команду
              </button>
            </>
          ) : (
            <p className="hint">Ожидание выбора команды…</p>
          )}
        </div>
      )}

      {game.phase === 'voting' && (
        <div className="panel">
          <h3>Предложенная команда</h3>
          <p>{game.teamProposal.map((id) => nameOf(players, id)).join(', ')}</p>
          {game.votesSubmitted.includes(myId) ? (
            <p className="hint">
              Голос принят. Ожидание остальных ({game.votesSubmitted.length}/{players.length})…
            </p>
          ) : (
            <div className="button-row">
              <button className="btn primary" onClick={() => onVote(true)}>
                Одобрить
              </button>
              <button className="btn danger" onClick={() => onVote(false)}>
                Отклонить
              </button>
            </div>
          )}
        </div>
      )}

      {game.phase === 'onMission' && (
        <div className="panel">
          <h3>Задание в процессе</h3>
          <p>Команда: {game.teamProposal.map((id) => nameOf(players, id)).join(', ')}</p>
          {game.teamProposal.includes(myId) ? (
            game.missionActionsSubmitted.includes(myId) ? (
              <p className="hint">Выбор сделан. Ожидание остальных участников…</p>
            ) : (
              <div className="button-row">
                <button className="btn primary" onClick={() => onMissionAction(true)}>
                  Успех
                </button>
                {privateInfo?.loyalty === 'evil' && (
                  <button className="btn danger" onClick={() => onMissionAction(false)}>
                    Провал
                  </button>
                )}
              </div>
            )
          ) : (
            <p className="hint">Ожидание выполнения задания…</p>
          )}
        </div>
      )}

      {game.phase === 'missionResult' && (
        <div className="panel">
          {(() => {
            const result = game.missions[game.round];
            if (!result) return null;
            return (
              <>
                <h3 className={result.success ? 'success-text' : 'fail-text'}>
                  Задание {result.success ? 'выполнено успешно' : 'провалено'}
                </h3>
                <p>Провалов подано: {result.fails}</p>
              </>
            );
          })()}
          <button className="btn primary" onClick={onContinue}>
            Продолжить
          </button>
        </div>
      )}

      {game.phase === 'assassin' && (
        <div className="panel">
          <h3>Слуги зла выбирают Ассасина</h3>
          {privateInfo?.isAssassin ? (
            <>
              <p>Добро набрало 3 успеха. Угадайте, кто Мерлин, чтобы вырвать победу!</p>
              <ul className="player-picker">
                {players
                  .filter((p) => p.id !== myId)
                  .map((p) => (
                    <li key={p.id}>
                      <label>
                        <input
                          type="radio"
                          name="assassin-target"
                          checked={assassinTarget === p.id}
                          onChange={() => setAssassinTarget(p.id)}
                        />
                        {p.name}
                      </label>
                    </li>
                  ))}
              </ul>
              <button
                className="btn danger"
                disabled={!assassinTarget}
                onClick={() => assassinTarget && onAssassinGuess(assassinTarget)}
              >
                Выстрелить
              </button>
            </>
          ) : (
            <p className="hint">Ассасин выбирает, кто из вас Мерлин…</p>
          )}
        </div>
      )}

      {game.phase === 'gameOver' && (
        <div className="panel">
          <h3 className={game.winner === 'good' ? 'success-text' : 'fail-text'}>
            Победа: {game.winner === 'good' ? 'Добро' : 'Зло'}
          </h3>
          <p>{game.winReason}</p>
          {game.merlinRevealId && (
            <p>
              Мерлин был: <strong>{nameOf(players, game.merlinRevealId)}</strong>
            </p>
          )}
          {game.allRolesRevealed && (
            <ul className="reveal-list">
              {players.map((p) => (
                <li key={p.id}>
                  {p.name} — {ROLE_LABELS[game.allRolesRevealed![p.id]] ?? game.allRolesRevealed![p.id]}
                </li>
              ))}
            </ul>
          )}
          {isHost ? (
            <button className="btn primary" onClick={onPlayAgain}>
              Играть снова
            </button>
          ) : (
            <p className="hint">Ожидание хоста…</p>
          )}
        </div>
      )}

      <button className="btn ghost" onClick={onLeave}>
        Покинуть игру
      </button>
    </div>
  );
}
