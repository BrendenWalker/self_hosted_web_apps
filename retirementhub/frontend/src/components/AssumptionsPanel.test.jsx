import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssumptionsPanel from './AssumptionsPanel';

function renderPanel() {
  return render(
    <MemoryRouter>
      <AssumptionsPanel />
    </MemoryRouter>
  );
}

describe('AssumptionsPanel', () => {
  test('lists included and excluded items', () => {
    renderPanel();
    fireEvent.click(screen.getByText(/Assumptions & limitations/i));
    expect(screen.getByText(/Federal income tax/i)).toBeInTheDocument();
    expect(screen.getByText(/State income tax/i)).toBeInTheDocument();
    expect(screen.getByText(/Not included/i)).toBeInTheDocument();
  });

  test('has a link to Tax details', () => {
    renderPanel();
    fireEvent.click(screen.getByText(/Assumptions & limitations/i));
    expect(screen.getByRole('link', { name: /Tax details/i })).toHaveAttribute('href', '/tax-details');
  });
});
