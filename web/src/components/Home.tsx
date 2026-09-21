import { useState } from 'react';

interface Props {
  connected: boolean;
  error: string | null;
  onCreate: (name: string) => void;
  onJoin: (roomCode: string, name: string) => void;
}

export function Home({ connected, error, onCreate, onJoin }: Props) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const canSubmit = name.trim().length > 0 && (mode === 'create' || roomCode.trim().length > 0);

  function submit() {
    if (!canSubmit) return;
    if (mode === 'create') onCreate(name.trim());
    else onJoin(roomCode.trim().toUpperCase(), name.trim());
  }

  return (
    <div className="screen home">
      <h1>Avalon</h1>
      <p className="subtitle">Играйте с друзьями в браузере</p>

      <div className="tabs">
        <button className={mode === 'create' ? 'tab active' : 'tab'} onClick={() => setMode('create')}>
          Создать игру
        </button>
        <button className={mode === 'join' ? 'tab active' : 'tab'} onClick={() => setMode('join')}>
          Присоединиться
        </button>
      </div>

      <div className="form">
        <input
          className="input"
          placeholder="Ваше имя"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />
        {mode === 'join' && (
          <input
            className="input"
            placeholder="Код комнаты"
            value={roomCode}
            maxLength={4}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
          />
        )}
        <button className="btn primary" disabled={!canSubmit || !connected} onClick={submit}>
          {mode === 'create' ? 'Создать комнату' : 'Войти в комнату'}
        </button>
        {!connected && <p className="hint">Подключение к серверу…</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
