import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSessionsStore, type SessionMap } from '@/lib/sessions';

// Ensure we always use the local store in these tests
vi.stubEnv('NEXT_PUBLIC_DATA_BACKEND', 'local');

const PP1 = '2025-09-01_2025-09-14';
const PP2 = '2025-09-15_2025-09-28';

describe('LocalSessionsStore', () => {
  beforeEach(() => {
    // Reset localStorage before each test
    window.localStorage.clear();
  });

  it('saves and loads a session map', async () => {
    const store = getSessionsStore();
    const map: SessionMap = {
      c1: { name: 'Alice', amount: 120, payPeriodId: PP1 },
      c2: { name: 'Bob', amount: 80, payPeriodId: PP1 },
    };
    await store.save(PP1, map);

    const loaded = await store.load(PP1);
    expect(Object.keys(loaded).sort()).toEqual(['c1', 'c2']);
    expect(loaded.c1.amount).toBe(120);
    expect(loaded.c2.name).toBe('Bob');
  });

  it('isolates data by pay period', async () => {
    const store = getSessionsStore();
    await store.save(PP1, { c1: { name: 'Alice', amount: 50, payPeriodId: PP1 } });
    await store.save(PP2, { c1: { name: 'Alice', amount: 70, payPeriodId: PP2 } });

    const a = await store.load(PP1);
    const b = await store.load(PP2);

    expect(a.c1.amount).toBe(50);
    expect(b.c1.amount).toBe(70);
  });

  it('clear removes only the targeted pay period data', async () => {
    const store = getSessionsStore();
    await store.save(PP1, { c1: { name: 'Alice', amount: 25, payPeriodId: PP1 } });
    await store.save(PP2, { c2: { name: 'Bob', amount: 10, payPeriodId: PP2 } });

    await store.clear(PP1);

    const a = await store.load(PP1);
    const b = await store.load(PP2);

    expect(Object.keys(a)).toHaveLength(0);
    expect(Object.keys(b)).toEqual(['c2']);
  });
});

