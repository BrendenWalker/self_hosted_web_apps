import '@testing-library/jest-dom';
import { vi } from 'vitest';

globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ version: 'dev' }),
});
