import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionTracker from '@/components/session/SessionTracker';
import type { Contractor } from '@/types/contractor';

function makeContractor(id: string, name: string): Contractor {
  return {
    id,
    name,
    address: { city: 'Seattle', state: 'WA', zipCode: '98101' },
    paymentInfo: { method: 'Cash', accountLastFour: '1234' },
    buildings: [],
    isActive: true,
    dateAdded: new Date().toISOString(),
  } as Contractor;
}

describe('SessionTracker (presentational)', () => {
  it('renders progress and allows toggling via prop callbacks', () => {
    const contractors = [makeContractor('c1', 'Alice'), makeContractor('c2', 'Bob')];
    const sessionDone: Record<string, { name: string; amount: number; payPeriodId: string }> = {
      c1: { name: 'Alice', amount: 100, payPeriodId: 'PP1' },
    };

    const toggleDone = vi.fn();
    const selectAll = vi.fn();
    const deselectAll = vi.fn();
    const retrySync = vi.fn();
    const onContractorOpen = vi.fn();

    render(
      <SessionTracker
        activeContractors={contractors}
        sessionDone={sessionDone}
        completed={1}
        percentComplete={50}
        allSelected={false}
        toggleDone={toggleDone}
        selectAll={selectAll}
        deselectAll={deselectAll}
        syncState="idle"
        syncBackend="local"
        retrySync={retrySync}
        onContractorOpen={onContractorOpen}
        summary={{
          currentPeriodLabel: 'PP1',
          totalPaid: 100,
          numStatements: 1,
          completedEntries: [{ id: 'c1', name: 'Alice', amount: 100 }],
          onClear: () => {},
          onDownloadPdf: () => {},
          onExportCsv: () => {},
        }}
      />
    );

    expect(screen.getByText(/1 \/ 2 done · 50%/)).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', { name: /mark alice done/i });
    fireEvent.click(checkbox);
    expect(toggleDone).toHaveBeenCalledWith('c1');

    const selectAllBtn = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllBtn);
    expect(selectAll).toHaveBeenCalled();
  });
});
