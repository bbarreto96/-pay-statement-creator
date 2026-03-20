import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock PDF rendering utility used by EmailAllModal
vi.mock("@/lib/pdf/renderPayStatementPdf", () => ({
  renderPayStatementPdfBase64: vi.fn().mockResolvedValue({ base64: "QUFB", mimeType: "application/pdf" }),
}));

import EmailAllModal from "@/components/session/EmailAllModal";

describe("EmailAllModal", () => {
  const entries = [
    { id: "a", name: "Alice", amount: 100 },
    { id: "b", name: "Bob", amount: 200 },
  ];
  const contractorsIndex = {
    a: { id: "a", name: "Alice", address: { street: "1 St", city: "NY", state: "NY", zipCode: "10001" }, paymentInfo: { method: "check" } },
    b: { id: "b", name: "Bob", address: { street: "2 St", city: "NY", state: "NY", zipCode: "10002" }, paymentInfo: { method: "check" } },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("disables send when recipients missing", () => {
    render(
      <EmailAllModal
        open
        onClose={() => {}}
        periodLabel="2025-10-01 — 2025-10-14"
        payPeriodId="pp-001"
        entries={entries}
        contractorsIndex={contractorsIndex}
      />
    );

    const sendBtn = screen.getByRole("button", { name: /create draft/i });
    expect(sendBtn).toBeDisabled();
  });

  it("sends email with generated attachments", async () => {
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "test-email-123" }),
    } as any);

    render(
      <EmailAllModal
        open
        onClose={() => {}}
        periodLabel="2025-10-01 — 2025-10-14"
        payPeriodId="pp-001"
        entries={entries}
        contractorsIndex={contractorsIndex}
      />
    );

    fireEvent.change(screen.getByLabelText(/recipients/i), { target: { value: "payroll@example.com" } });
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: "Subject" } });
    fireEvent.change(screen.getByLabelText(/body/i), { target: { value: "Body" } });

    const sendBtn = screen.getByRole("button", { name: /create draft/i });
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/email/send-session");
    const payload = JSON.parse(options.body);
    expect(payload.to).toEqual(["payroll@example.com"]);
    expect(payload.attachments).toHaveLength(0);
    expect(payload.renderItems).toHaveLength(2);

    // Success message visible (macOS draft by default)
    await screen.findByText(/draft created in mail/i);
  });
});
