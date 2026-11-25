import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { OfflineQueueProvider } from '../context/OfflineQueueContext';
import HomePage from './HomePage';

vi.mock('../api/client', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  fetchDashboard: vi.fn(async () => ({ pets: [{ id: 1, name: 'Noodle' }] })),
  fetchLatestByType: vi.fn(async () => ({ ok: true, latest: {} })),
  fetchSpeedometer: vi.fn(async () => ({})),
  getDefaultPet: vi.fn(async () => ({ default_pet_id: 1 })),
  setDefaultPet: vi.fn(async () => ({})),
  fetchMe: vi.fn(async () => ({ authenticated: true, user: { is_admin: false } })),
}));

function renderHome() {
  return render(
    <AuthProvider>
      <OfflineQueueProvider>
        <HomePage />
      </OfflineQueueProvider>
    </AuthProvider>
  );
}

describe('pee amount', () => {
  it('uses 1–10 with a default of 10, and leaves poop on 1–7', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /Toilet/ }));

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '10');
    expect(slider).toHaveValue('10');
    expect(screen.getByText('Tiny amount')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Poop/ }));
    expect(screen.getByRole('slider')).toHaveAttribute('max', '7');
    expect(screen.getByRole('slider')).toHaveValue('2');

    fireEvent.click(screen.getByRole('button', { name: /^Pee/ }));
    expect(screen.getByRole('slider')).toHaveAttribute('max', '10');
    expect(screen.getByRole('slider')).toHaveValue('10');
  });
});
