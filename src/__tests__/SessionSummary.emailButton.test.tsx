import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionSummary from "@/components/session/SessionSummary";

describe("SessionSummary Email button", () => {
  it("calls onEmailAll when clicking Send All via Email", () => {
    const onEmailAll = vi.fn();
    render(
      <SessionSummary
        currentPeriodLabel="2025-10-01  2025-10-14"
        totalPaid={300}
        numStatements={2}
        completedEntries={[{ id: "a", name: "Alice", amount: 100 }, { id: "b", name: "Bob", amount: 200 }]}
        onClear={() => {}}
        onDownloadPdf={() => {}}
        onExportCsv={() => {}}
        onEmailAll={onEmailAll}
      />
    );

    const btn = screen.getByRole("button", { name: /send all via email/i });
    fireEvent.click(btn);
    expect(onEmailAll).toHaveBeenCalledTimes(1);
  });
});

