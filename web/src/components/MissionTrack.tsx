import type { MissionSpec } from '../types';

interface Props {
  missionSpecs: MissionSpec[];
  missions: Array<{ success: boolean; fails: number } | null>;
  round: number;
}

export function MissionTrack({ missionSpecs, missions, round }: Props) {
  return (
    <div className="mission-track">
      {missionSpecs.map((spec, i) => {
        const result = missions[i];
        let cls = 'mission-pip';
        if (result) cls += result.success ? ' success' : ' fail';
        else if (i === round) cls += ' current';

        return (
          <div key={i} className={cls} title={`${spec.players} игрока, нужно ${spec.failsRequired} провалов`}>
            <span className="pip-players">{spec.players}</span>
            {result && <span className="pip-icon">{result.success ? '✔' : '✘'}</span>}
          </div>
        );
      })}
    </div>
  );
}
