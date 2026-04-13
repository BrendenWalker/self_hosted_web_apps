import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const mockResolve = (data = []) => Promise.resolve({ data });
vi.mock('./api/api', () => ({
  getVehicles: () => mockResolve([]),
  getVehicle: () => mockResolve({}),
  createVehicle: () => mockResolve({}),
  updateVehicle: () => mockResolve({}),
  deleteVehicle: () => mockResolve({}),
  getServiceTypes: () => mockResolve([]),
  getServiceType: () => mockResolve({}),
  createServiceType: () => mockResolve({}),
  updateServiceType: () => mockResolve({}),
  deleteServiceType: () => mockResolve({}),
  getServiceIntervals: () => mockResolve([]),
  createServiceInterval: () => mockResolve({}),
  updateServiceInterval: () => mockResolve({}),
  deleteServiceInterval: () => mockResolve({}),
  getServiceLog: () => mockResolve([]),
  getAllServiceLog: () => mockResolve([]),
  getServiceLogEntry: () => mockResolve({}),
  createServiceLogEntry: () => mockResolve({}),
  updateServiceLogEntry: () => mockResolve({}),
  deleteServiceLogEntry: () => mockResolve({}),
  getUpcomingServices: () => mockResolve([]),
  recalculateIntervals: () => mockResolve({}),
  default: {},
}));

describe('App', () => {
  it('renders navbar with VehicleHub branding and main links', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'VehicleHub' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Vehicles' })).toHaveAttribute('href', '/vehicles');
    expect(screen.getByRole('link', { name: 'Service Types' })).toHaveAttribute('href', '/service-types');
    expect(screen.getByRole('link', { name: 'Service History' })).toHaveAttribute('href', '/service-log');
    await waitFor(() => {
      expect(screen.queryByText(/loading upcoming services/i)).not.toBeInTheDocument();
    });
  });

  it('renders HomePage at /', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /welcome to vehiclehub/i })).toBeInTheDocument();
  });

  it('renders VehiclesPage at /vehicles', async () => {
    render(
      <MemoryRouter initialEntries={['/vehicles']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Vehicles' })).toBeInTheDocument();
  });
});
