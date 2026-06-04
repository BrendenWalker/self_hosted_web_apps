import React from 'react';
import { render, screen } from '@testing-library/react';
import PrecisionBadge from './PrecisionBadge';

describe('PrecisionBadge', () => {
  test('renders Published badge for seeded source', () => {
    render(<PrecisionBadge source="seeded" yearUsed={2026} />);
    expect(screen.getByText(/Published/i)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  test('renders Projected badge with inflation note when inflation_applied', () => {
    render(<PrecisionBadge source="seeded" yearUsed={2026} inflationApplied />);
    expect(screen.getByText(/Projected/i)).toBeInTheDocument();
  });

  test('renders User-edited badge in amber for user_edited source', () => {
    const { container } = render(<PrecisionBadge source="user_edited" yearUsed={2026} />);
    expect(screen.getByText(/User-edited/i)).toBeInTheDocument();
    expect(container.querySelector('.badge-amber')).toBeInTheDocument();
  });
});
