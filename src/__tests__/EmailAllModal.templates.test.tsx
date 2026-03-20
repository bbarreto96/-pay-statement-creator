import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmailAllModal from "@/components/session/EmailAllModal";

vi.mock("jspdf", () => ({ default: class { internal = { pageSize: { getWidth: () => 612 } }; setFont(){} setFontSize(){} setDrawColor(){} setTextColor(){} text(){} line(){} output(){return "data:application/pdf;base64,QUFB";} } }));

describe("EmailAllModal templates", () => {
  const entries = [
    { id: "a", name: "Alice", amount: 100 },
    { id: "b", name: "Bob", amount: 200 },
  ];
  const contractorsIndex = { a: { id: "a", name: "Alice", address: { street: "1 St", city: "NY", state: "NY", zipCode: "10001" }, paymentInfo: { method: "check" } }, b: { id: "b", name: "Bob", address: { street: "2 St", city: "NY", state: "NY", zipCode: "10002" }, paymentInfo: { method: "check" } } } as any;

  it("applies selected template to subject and body", () => {
    render(
      <EmailAllModal
        open
        onClose={() => {}}
        periodLabel="2025-10-01 — 2025-10-14"
        entries={entries}
        contractorsIndex={contractorsIndex}
      />
    );

    const templateSelect = screen.getByLabelText(/template/i);
    fireEvent.change(templateSelect, { target: { value: "short" } });

    const subj = screen.getByLabelText(/subject/i) as HTMLInputElement;
    const body = screen.getByLabelText(/body/i) as HTMLTextAreaElement;

    expect(subj.value.toLowerCase()).toContain("2025-10-01");
    expect(body.value.toLowerCase()).toContain("2 statements");
  });
});

