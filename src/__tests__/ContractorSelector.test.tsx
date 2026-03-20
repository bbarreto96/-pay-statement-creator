import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContractorSelector from '@/components/ContractorSelector';
import type { Contractor } from '@/types/contractor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/data', () => {
  return {
    getDataClient: () => ({
      listActiveContractors: async () => [
        makeContractor('c1', 'Alice', '1111', 'Seattle', 'WA'),
        makeContractor('c2', 'Bob', '2222', 'Bellevue', 'WA'),
        makeContractor('c3', 'Charlie', '3333', 'Tacoma', 'WA'),
      ],
    }),
  };
});

function makeContractor(
  id: string,
  name: string,
  last4: string,
  city: string,
  state: string
): Contractor {
  return {
    id,
    name,
    address: { city, state, zipCode: '' },
    paymentInfo: { method: 'Cash', accountLastFour: last4 },
    buildings: [],
    isActive: true,
    dateAdded: new Date().toISOString(),
  } as Contractor;
}

describe('ContractorSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('filters by search input and supports keyboard selection', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ContractorSelector onContractorSelect={onSelect} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'bo'); // debounce 200ms

    // wait a tick beyond debounce
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    // dropdown should open and show only Bob
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Bob')).toBeInTheDocument();
    expect(within(listbox).queryByText('Alice')).not.toBeInTheDocument();

    // Arrow down, Enter selects Bob
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].name).toBe('Bob');
  });

  it('closes on outside click', async () => {
    const onSelect = vi.fn();
    render(
      <div>
        <ContractorSelector onContractorSelect={onSelect} />
        <button data-testid="outside">outside</button>
      </div>
    );

    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    // list opens with all options
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('outside'));

    // listbox should be gone
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
