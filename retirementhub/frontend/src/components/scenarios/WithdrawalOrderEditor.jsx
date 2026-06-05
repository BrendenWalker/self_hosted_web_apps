import React from 'react';
import { WITHDRAWAL_BUCKETS } from '../../constants/scenarioOptions';

export default function WithdrawalOrderEditor({ order, onChange }) {
  const keys = order?.length ? [...order] : WITHDRAWAL_BUCKETS.map((b) => b.key);

  const move = (index, dir) => {
    const next = [...keys];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange?.(next);
  };

  const labelFor = (key) => WITHDRAWAL_BUCKETS.find((b) => b.key === key)?.label || key;

  return (
    <div className="withdrawal-order-editor">
      <p className="scenario-help">
        Order determines drawdown sequence after Social Security, RMDs, and wages. First bucket listed is drawn first.
      </p>
      <ol className="withdrawal-order-list">
        {keys.map((key, i) => (
          <li key={key} className="withdrawal-order-item">
            <span>{i + 1}. {labelFor(key)}</span>
            <span className="withdrawal-order-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                Up
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={i === keys.length - 1}
                onClick={() => move(i, 1)}
              >
                Down
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
