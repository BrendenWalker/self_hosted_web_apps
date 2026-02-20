import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch so components like VersionFooter don't throw or hang in tests
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ version: 'dev' }),
});
