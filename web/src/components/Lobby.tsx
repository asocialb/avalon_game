import type { RoomSettings, RoomState } from '../types';

interface Props {
  room: RoomState;
  myId: string;
  error: string | null;
  onToggleSetting: (key: keyof RoomSettings, value: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
}

const ROLE_INFO: Array<{ key: keyof RoomSettings; label: string; description: string }> = [
  { key: 'percival', label: 'Персиваль', description: 'Видит Мерлина (и Моргану, если она включена)' },
  { key: 'morgana', label: 'Моргана', description: 'Персиваль видит её как возможного Мерлина' },
  { key: 'mordred', label: 'Мордред', description: 'Скрыт от Мерлина' },
  { key: 'oberon', label: 'Оберон', description: 'Не знает других слуг зла и не известен им' },
];

export function Lobby({ room, myId, error, onToggleSetting, onStart, onLeave }: Props) {
  const isHost = room.hostId === myId;
  const count = room.players.length;
  const canStart = count >= 5 && count <= 10;

  return (
    <div className="screen lobby">
      <div className="room-code-banner">
        <span>Код комнаты</span>
        <strong>{room.code}</strong>
      </div>

      <h2>Игроки ({count}/10)</h2>
      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'disconnected'}>
            {p.id === room.hostId && <span className="crown">👑</span>}
            {p.name}
            {p.id === myId && <span className="you"> (вы)</span>}
            {!p.connected && <span className="hint"> — отключён</span>}
          </li>
        ))}
      </ul>
      {count < 5 && <p className="hint">Нужно минимум 5 игроков</p>}

      {isHost && (
        <div className="settings">
          <h3>Дополнительные роли</h3>
          {ROLE_INFO.map((r) => (
            <label key={r.key} className="role-toggle">
              <input
                type="checkbox"
                checked={room.settings[r.key]}
                onChange={(e) => onToggleSetting(r.key, e.target.checked)}
              />
              <span>
                <strong>{r.label}</strong>
                <br />
                <small>{r.description}</small>
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {isHost ? (
        <button className="btn primary" disabled={!canStart} onClick={onStart}>
          Начать игру
        </button>
      ) : (
        <p className="hint">Ожидание, пока хост начнёт игру…</p>
      )}

      <button className="btn ghost" onClick={onLeave}>
        Покинуть комнату
      </button>
    </div>
  );
}
