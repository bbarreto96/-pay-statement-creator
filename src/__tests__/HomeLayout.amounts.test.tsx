import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeLayout from '@/components/HomeLayout';
import type { Contractor } from '@/types/contractor';
import type { PayStatementData } from '@/types/payStatement';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// Provide deterministic contractors
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

// Minimal PayStatementForm that immediately supplies data to HomeLayout via onDataChange
vi.mock('@/components/PayStatementForm', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ onDataChange }: { onDataChange: (d: PayStatementData) => void }) => {
      const data = {
        totalPayment: 100,
        payment: { payPeriodId: 'P1' },
      } as any as PayStatementData;
      React.useEffect(() => {
        onDataChange(data);
      }, [onDataChange]);
      return <div data-testid="mock-form">FORM</div>;
    },
  };
});

// Mock ContractorSelector to let the test select Alice easily
vi.mock('@/components/ContractorSelector', () => {
  const alice: Contractor = {
    id: 'a',
    name: 'Alice',
    address: { city: '', state: '', zipCode: '' },
    paymentInfo: { method: 'Cash', accountLastFour: '0000' },
    buildings: [],
    isActive: true,
    dateAdded: new Date().toISOString(),
  } as Contractor;
  return {
    __esModule: true,
    default: ({ onContractorSelect }: { onContractorSelect: (c: Contractor) => void }) => (
      <button onClick={() => onContractorSelect(alice)}>select-alice</button>
    ),
  };
});

// Mock SessionTracker to expose toggleDone and show amounts per contractor id
vi.mock('@/components/session/SessionTracker', () => {
  return {
    __esModule: true,
    default: (props: any) => {
      const { activeContractors, toggleDone, sessionDone } = props;
      return (
        <div>
          <div data-testid="count">{activeContractors.length}</div>
          {activeContractors.map((c: Contractor) => (
            <div key={c.id}>
              <button data-testid={`toggle-${c.id}`} onClick={() => toggleDone(c.id)}>
                toggle-{c.id}
              </button>
              <span data-testid={`amount-${c.id}`}>{sessionDone[c.id]?.amount ?? ''}</span>
            </div>
          ))}
        </div>
      );
    },
  };
});

describe('HomeLayout amount preservation', () => {
  it('preserves last amount when toggling contractor off and back on', async () => {
    render(<HomeLayout />);

    // Wait for contractors to be present in mocked tracker
    await screen.findByTestId('count');

    // Select Alice to open the form
    await userEvent.click(screen.getByText('select-alice'));

    // Mark Done to store amount 100 for Alice
    const markButtons = await screen.findAllByRole('button', { name: 'Mark Done' });
    await userEvent.click(markButtons[0]);

    // Toggle Alice off: amount should disappear from session map
    await userEvent.click(screen.getByTestId('toggle-a'));
    expect(screen.getByTestId('amount-a')).toHaveTextContent('');

    // Toggle Alice on: amount should restore to 100 from lastAmounts cache
    await userEvent.click(screen.getByTestId('toggle-a'));
    expect(screen.getByTestId('amount-a')).toHaveTextContent('100');
  });
});
