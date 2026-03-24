"use client";

import React, { useMemo, useState } from "react";
import { formatUSD } from "@/utils/format";
import { Contractor } from "@/types/contractor";
import { emailTemplates, renderTemplate } from "@/lib/email/templates";
import { renderPayStatementPdfBase64 } from "@/lib/pdf/renderPayStatementPdf";
import { PayStatementData } from "@/types/payStatement";
import { getPayStatementsClient } from "@/lib/data/payStatements";
import { getPayPeriodById } from "@/utils/payPeriods";
import { getCompanyConfig } from "@/lib/companyConfig";

type EntryStatus = "Pending" | "Preparing" | "Rendered" | "Sent" | "Draft" | "Failed";

export type SummaryEntry = { id: string; name: string; amount: number };

export interface EmailAllModalProps {
  open: boolean;
  onClose: () => void;
  periodLabel: string;
  payPeriodId: string; // ensure we can match saved statements and set payment.payPeriodId
  entries: SummaryEntry[]; // completed entries for current session
  payStatementPreset?: "current" | "bpv1";
  contractorsIndex: Record<string, Contractor>; // by id for address/method
}

// Build PayStatementData when no saved statement is found
const buildFallbackData = (entry: SummaryEntry, c?: Contractor, payPeriodId?: string): PayStatementData => {
  const amt = Math.round((entry.amount || 0) * 100) / 100; // round to cents
  const co = getCompanyConfig();
  return {
    companyName: co.name,
    companyAddress: {
      street: co.address.street,
      suite: co.address.suite || "",
      city: co.address.city,
      state: co.address.state,
      zipCode: co.address.zipCode,
    },
    companyPhone: co.phone,
    paidTo: {
      name: entry.name,
      address: {
        street: c?.address?.street || "",
        city: c?.address?.city || "",
        state: c?.address?.state || "",
        zipCode: c?.address?.zipCode || "",
      },
    },
    payment: {
      payPeriodId: payPeriodId || "",
      method: c?.paymentInfo?.method || "Direct Deposit",
    },
    paymentDetails: [{ description: "Payment", amount: amt }],
    summary: [
      { description: "Payment", payPerVisit: amt, numberOfVisits: 1, total: amt },
    ],
    totalPayment: amt,
    notes: "",
  };
};

const EmailAllModal: React.FC<EmailAllModalProps> = ({ open, onClose, periodLabel, payPeriodId, entries, contractorsIndex, payStatementPreset }) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(() => `Pay Statements – ${periodLabel}`);
  const [body, setBody] = useState("Please find attached the pay statements for the selected contractors.");
  const [templateKey, setTemplateKey] = useState<string>("summary");
  const [useMacOSMail, setUseMacOSMail] = useState<boolean>(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selection and status tracking
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(entries.map(e => [e.id, true])));
  const [statuses, setStatuses] = useState<Record<string, EntryStatus>>(() => Object.fromEntries(entries.map(e => [e.id, "Pending"])));

  const visibleEntries = useMemo(() => entries.filter(e => selected[e.id] !== false), [entries, selected]);
  const count = visibleEntries.length;
  const totalAmount = useMemo(() => visibleEntries.reduce((sum, e) => sum + (e.amount || 0), 0), [visibleEntries]);
  const canSend = useMemo(() => {
    const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
    return recipients.length > 0 && subject.trim().length > 0 && count > 0;
  }, [to, subject, count]);

  if (!open) return null;

  const onSend = async () => {
    try {
      setError(null);
      setSuccess(null);
      setSending(true);

      // Always prefer server-side print-engine rendering; skip client canvas generation
      const useServerRender = true;
      const attachments: { filename: string; contentBase64: string; mimeType: string }[] = [];
      const serverRenderItemsLocal: { filename: string; preset?: "current" | "bpv1"; data: PayStatementData }[] = [];

      const client = getPayStatementsClient();
      const period = getPayPeriodById(payPeriodId);

      // Simple in-memory cache for this session
      const cache = new Map<string, PayStatementData>();
      const keyOf = (cid: string) => `${cid}::${payPeriodId}`;

      // Concurrency limiter (5 concurrent)
      const limit = (max: number) => {
        let active = 0; const q: (() => void)[] = [];
        const next = () => { active--; if (q.length) q.shift()!(); };
        return async function <T>(fn: () => Promise<T>): Promise<T> {
          if (active >= max) await new Promise<void>((r) => q.push(r));
          active++;
          try { return await fn(); } finally { next(); }
        };
      };
      const run5 = limit(5);

      // Load data for selected entries in parallel with caching
      const results = await Promise.allSettled(visibleEntries.map((e) => run5(async () => {
        setStatuses((s) => ({ ...s, [e.id]: "Preparing" }));
        const contractor = contractorsIndex[e.id];
        const ck = keyOf(e.id);
        if (cache.has(ck)) return { entry: e, data: cache.get(ck)! };

        let data: PayStatementData | null = null;
        try {
          const list = await client.listByContractorId(e.id);
          let matchedKey: string | null = null;
          for (const s of list) {
            if (s.data?.payment?.payPeriodId && s.data.payment.payPeriodId === payPeriodId) { matchedKey = s.key; break; }
          }
          if (!matchedKey && period) {
            const byEndDate = list.find((s) => s.dateISO === period.endDate);
            if (byEndDate) matchedKey = byEndDate.key;
          }
          if (matchedKey) {
            data = (await client.load(matchedKey)) as PayStatementData | null;
          }
        } catch {}
        if (!data) data = buildFallbackData(e, contractor, payPeriodId);
        if (data && !data.payment?.payPeriodId) data = { ...data, payment: { ...data.payment, payPeriodId } };
        cache.set(ck, data);
        return { entry: e, data };
      })));

      // Build filenames and server render items (and attachments only if not server rendering)
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const e = visibleEntries[i];
        if (r.status === "rejected") {
          setStatuses((s) => ({ ...s, [e.id]: "Failed" }));
          continue;
        }
        const data = r.value.data;
        const safeName = `${e.name} - ${periodLabel}`.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const filename = `${safeName}.pdf`;
        serverRenderItemsLocal.push({ filename, preset: payStatementPreset || "bpv1", data });
        setStatuses((s) => ({ ...s, [e.id]: "Rendered" }));
        if (!useServerRender) {
          const { base64, mimeType } = await renderPayStatementPdfBase64(data, { preset: payStatementPreset || "bpv1" });
          try { console.debug("[EmailAllModal] Attachment", safeName, { bytes: Math.floor((base64.length * 3) / 4) }); } catch {}
          attachments.push({ filename, contentBase64: base64, mimeType });
        }
      }

      const filenames = (useServerRender ? serverRenderItemsLocal.map(i => i.filename) : attachments.map(a => a.filename));

      const resp = await fetch("/api/email/send-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.split(",").map((s) => s.trim()).filter(Boolean),
          subject,
          body,
          attachments, // empty when server rendering, present only if fallback used
          renderItems: serverRenderItemsLocal,
          meta: {
            payPeriodLabel: periodLabel,
            count,
            totalAmount,
            filenames,
          },
          mode: useMacOSMail ? "macos" : "resend",
        }),
      });

      const js = await resp.json();
      if (!resp.ok) throw new Error(js?.error || `HTTP ${resp.status}`);
      setSuccess(useMacOSMail ? "Draft created in Mail." : "Email sent successfully.");
      // Mark statuses
      setStatuses((s) => {
        const next = { ...s };
        for (const e of visibleEntries) next[e.id] = useMacOSMail ? "Draft" : "Sent";
        return next;
      });
    } catch (err) {
      const raw = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || String(err);
      const friendly =
        /RESEND_API_KEY/i.test(raw) || /RESEND_FROM/i.test(raw)
          ? "Resend is not configured (missing RESEND_API_KEY or RESEND_FROM). Use macOS Mail or configure Resend."
          : /osascript/i.test(raw)
          ? "Could not create a draft in Mail.app (osascript error). Please ensure Mail is installed and accessible."
          : /Failed to launch the browser/i.test(raw)
          ? "Server could not launch headless Chrome. If running on Linux, install required dependencies."
          : raw;
      setError(friendly);
      // Only mark as failed those that weren't already Rendered/Sent/Draft
      setStatuses((s) => {
        const next = { ...s };
        for (const e of visibleEntries) {
          if (next[e.id] !== "Rendered" && next[e.id] !== "Sent" && next[e.id] !== "Draft") {
            next[e.id] = "Failed";
          }
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  };

  const failedEntries = entries.filter(e => statuses[e.id] === "Failed");
  const hasFailures = failedEntries.length > 0;

  const retryFailed = () => {
    // Uncheck all non-failed entries so only failed ones are retried
    setStatuses((s) => {
      const next = { ...s };
      for (const e of entries) if (next[e.id] === "Failed") next[e.id] = "Pending";
      return next;
    });
    void onSend();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-black">Send All via Email</h3>
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-black">✕</button>
        </div>
        <div className="text-sm text-gray-700 mb-3">
          {count} attachment{count === 1 ? "" : "s"} will be generated for pay period <strong>{periodLabel}</strong>.
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="email-recipients" className="block text-xs font-medium text-gray-700 mb-1">Recipients (comma-separated)</label>
            <input id="email-recipients" value={to} onChange={(e) => setTo(e.target.value)} placeholder="payroll@company.com, manager@company.com" className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <input id="use-mac" type="checkbox" checked={useMacOSMail} onChange={(e) => setUseMacOSMail(e.target.checked)} />
            <label htmlFor="use-mac" className="text-xs text-gray-800">Create draft in macOS Mail (recommended)</label>
          </div>
          <div>
            <label htmlFor="email-template" className="block text-xs font-medium text-gray-700 mb-1">Template</label>
            <select
              id="email-template"
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={templateKey}
              onChange={(e) => {
                const key = e.target.value;
                setTemplateKey(key);
                const t = emailTemplates.find((t) => t.key === key) || emailTemplates[0];
                const rendered = renderTemplate(t, { payPeriod: periodLabel, count, totalAmount: formatUSD(totalAmount) });
                setSubject(rendered.subject);
                setBody(rendered.body);
              }}
            >
              {emailTemplates.map((t) => (
                <option key={t.key} value={t.key}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="email-subject" className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
            <input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="email-body" className="block text-xs font-medium text-gray-700 mb-1">Body</label>
            <textarea id="email-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        {/* Contractors selection and statuses */}
        <div className="mt-3 border rounded-md p-2 max-h-56 overflow-auto">
          <div className="text-xs font-medium text-gray-700 mb-1">Contractors</div>
          {entries.map((e) => (
            <label key={e.id} className="flex items-center justify-between py-1 text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected[e.id] !== false}
                  onChange={(ev) => setSelected((m) => ({ ...m, [e.id]: ev.target.checked }))}
                />
                <span className="text-gray-900">{e.name}</span>
                <span className="text-gray-500">{formatUSD(e.amount || 0)}</span>
              </span>
              <span className="text-xs">
                <span className={
                  statuses[e.id] === "Failed" ? "text-red-700" :
                  statuses[e.id] === "Rendered" ? "text-emerald-700" :
                  statuses[e.id] === "Draft" || statuses[e.id] === "Sent" ? "text-blue-700" :
                  statuses[e.id] === "Preparing" ? "text-amber-700" : "text-gray-500"
                }>
                  {statuses[e.id] || "Pending"}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {error}
            {hasFailures && (
              <div className="mt-1 text-xs text-red-600">
                {failedEntries.length} contractor{failedEntries.length === 1 ? "" : "s"} failed: {failedEntries.map(e => e.name).join(", ")}
              </div>
            )}
          </div>
        )}
        {success && <div className="mt-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">{success}</div>}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {hasFailures && !sending && (
              <button onClick={retryFailed} className="px-3 py-1.5 text-sm rounded-md border border-amber-300 text-amber-800 hover:bg-amber-50">
                Retry {failedEntries.length} Failed
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border">Cancel</button>
            <button onClick={onSend} disabled={!canSend || sending} className={`px-3 py-1.5 text-sm rounded-md text-white ${sending || !canSend ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}>
              {sending ? (useMacOSMail ? "Opening Mail..." : "Sending...") : (useMacOSMail ? "Create Draft" : "Send All via Email")}
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          {useMacOSMail ? "macOS only: this will open Mail.app with a draft message and attachments." : "Requires server config: RESEND_API_KEY and RESEND_FROM."}
        </div>
      </div>
    </div>
  );
};

export default EmailAllModal;

