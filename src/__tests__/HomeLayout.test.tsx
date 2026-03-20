import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeLayout from '@/components/HomeLayout';
import type { Contractor } from '@/types/contractor';

// Mock next/navigation to avoid router mount errors
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// Mock data client to provide deterministic contractors
vi.mock('@/lib/data', () => {
  function make(id: string, name: string): Contractor {
    return {
      id,
      name,
      address: { city: '', state: '', zipCode: '' },
      paymentInfo: { method: 'Cash', accountLastFour: '0000' },
      buildings: [],
      isActive: true,
      dateAdded: new Date().toISOString(),
    } as Contractor;
  }
  return {
    getDataClient: () => ({
      listActiveContractors: async () => [make('a', 'Alice'), make('b', 'Bob')],
      listAllContractors: async () => [make('a', 'Alice'), make('b', 'Bob')],
    }),
  };
});

// Mock sessions store (no-op persistence, empty initial load)
vi.mock('@/lib/sessions', async () => {
  const actual: any = await vi.importActual('@/lib/sessions');
  return {
    ...actual,
    getSessionsStore: () => ({
      kind: 'local',
      async load() { return {}; },
      async save() { /* no-op */ },
      async clear() { /* no-op */ },
    }),
  };
});

// Mock SessionTracker to a minimal harness exposing the props we want to exercise
vi.mock('@/components/session/SessionTracker', () => {
  return {
    __esModule: true,
    default: (props: any) => {
      const { allSelected, selectAll, deselectAll, activeContractors } = props;
      return (
        <div>
          <div data-testid="count">{activeContractors.length}</div>
          <div data-testid="allSelected">{String(allSelected)}</div>
          <button onClick={selectAll}>selectAll</button>
          <button onClick={deselectAll}>deselectAll</button>
        </div>
      );
    },
  };
});

describe('HomeLayout session flows', () => {
  it('select all and deselect all toggle allSelected flag as contractors load', async () => {
    render(<HomeLayout />);

    // Wait until contractors have loaded into the mocked tracker
    const countEl = await screen.findByTestId('count');
    expect(countEl).toHaveTextContent('2');

    // Initially, nothing selected
    expect(screen.getByTestId('allSelected')).toHaveTextContent('false');

    // Select all
    await userEvent.click(screen.getByText('selectAll'));

    // After state update, allSelected should become true
    // findBy... to allow re-render
    await screen.findByText('true', {}, { selector: '[data-testid="allSelected"]' });

    // Deselect all
    await userEvent.click(screen.getByText('deselectAll'));

    // allSelected back to false
    await screen.findByText('false', {}, { selector: '[data-testid="allSelected"]' });
  });
});

