import type { Player, PrivateRoleInfo } from '../types';

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

function nameOf(players: Player[], id: string) {
  return players.find((p) => p.id === id)?.name ?? '???';
}

export function RolePanel({ info, players }: { info: PrivateRoleInfo; players: Player[] }) {
  const loyaltyLabel = info.loyalty === 'good' ? 'Добро' : 'Зло';

  return (
    <details className="role-panel" open>
      <summary>
        Ваша роль: <strong>{ROLE_LABELS[info.role] ?? info.role}</strong> ({loyaltyLabel})
      </summary>
      <div className="role-panel-body">
        {info.knownEvilIds.length > 0 && (
          <p>
            Слуги зла: <strong>{info.knownEvilIds.map((id) => nameOf(players, id)).join(', ')}</strong>
          </p>
        )}
        {info.merlinCandidateIds.length > 0 && (
          <p>
            Мерлин — один из:{' '}
            <strong>{info.merlinCandidateIds.map((id) => nameOf(players, id)).join(' или ')}</strong>
          </p>
        )}
        {info.isAssassin && <p>Вы — Ассасин. В конце игры вы попытаетесь угадать Мерлина.</p>}
      </div>
    </details>
  );
}
