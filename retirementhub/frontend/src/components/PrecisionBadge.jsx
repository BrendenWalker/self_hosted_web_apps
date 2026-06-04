import React from 'react';

export default function PrecisionBadge({ source, yearUsed, inflationApplied, modified }) {
  let label;
  let tone;
  if (source === 'user_edited') {
    label = `User-edited (${yearUsed})`;
    tone = 'amber';
  } else if (inflationApplied) {
    label = `Projected from ${yearUsed}`;
    tone = 'grey';
  } else {
    label = `Published ${yearUsed}`;
    tone = 'green';
  }
  return (
    <span
      className={`precision-badge badge-${tone}`}
      title={modified ? `Last modified ${modified}` : undefined}
    >
      {label}
    </span>
  );
}
