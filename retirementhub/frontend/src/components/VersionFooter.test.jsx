import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VersionFooter from './VersionFooter';

describe('VersionFooter', () => {
  it('shows frontend and backend version placeholders', async () => {
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0' }),
    });

    render(<VersionFooter />);

    expect(screen.getByText(/Frontend/)).toBeInTheDocument();
    expect(screen.getByText(/Backend/)).toBeInTheDocument();

    await screen.findByText(/Backend 1\.0\.0/);
    expect(window.fetch).toHaveBeenCalledWith('/api/health');
  });

  it('shows fallback when health fetch fails', async () => {
    window.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    render(<VersionFooter />);

    await screen.findByText(/Backend —/);
  });
});
