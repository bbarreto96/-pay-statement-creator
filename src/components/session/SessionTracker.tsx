"use client";

import React, { useState } from "react";
import { Contractor } from "@/types/contractor";
import SessionSummary, { SessionSummaryProps } from "./SessionSummary";
import { formatUSD } from "@/utils/format";

export type SyncState = "idle" | "loading" | "saving" | "error";
export type SyncBackend = "supabase" | "local";

export interface SessionTrackerProps {
  activeContractors: Contractor[];
  sessionDone: Record<string, { name: string; amount: number; payPeriodId: string }>;
  completed: number;
  percentComplete: number;
  allSelected: boolean;
  toggleDone: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  syncState: SyncState;
  syncBackend: SyncBackend;
  retrySync: () => void;
  onContractorOpen: (c: Contractor) => void;
  summary: SessionSummaryProps;
}

const SessionTracker: React.FC<SessionTrackerProps> = ({
  activeContractors,
  sessionDone,
  completed,
  percentComplete,
  allSelected,
  toggleDone,
  selectAll,
  deselectAll,
  syncState,
  syncBackend,
  retrySync,
  onContractorOpen,
  summary,
}) => {
  const [tableVisible, setTableVisible] = useState(false);

  return (
    <div>
      {/* Compact header row — always visible */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h4 className="section-title text-sm md:text-base text-black whitespace-nowrap">Session</h4>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-2 w-28 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${percentComplete}%` }} />
              </div>
              <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap">{completed}/{activeContractors.length} · {percentComplete}%</span>
            </div>
            <span className="sm:hidden text-xs text-gray-600">{completed}/{activeContractors.length}</span>
            {syncState === "saving" && (
              <span className="text-[11px] px-1.5 py-0.5 rounded border border-orange-200 text-orange-700 bg-orange-50">Syncing...</span>
            )}
            {syncState === "error" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] px-1.5 py-0.5 rounded border border-amber-300 text-amber-800 bg-amber-50">Offline</span>
                <button onClick={retrySync} className="btn-ghost text-[11px] py-0.5">Retry</button>
              </div>
            )}
            {syncState !== "error" && syncBackend === "supabase" && (
              <span className="text-[11px] px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-800 bg-emerald-50">Synced</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={allSelected ? deselectAll : selectAll} className="btn-ghost text-xs py-1 px-2.5">
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            onClick={() => setTableVisible((v) => !v)}
            className="btn-ghost text-xs py-1 px-2.5"
            title={tableVisible ? "Hide contractor table" : "Show contractor table"}
          >
            {tableVisible ? "Hide ▲" : "Details ▼"}
          </button>
        </div>
      </div>

      {/* Collapsible table */}
      {tableVisible && (
        <div className="mt-3">
          {activeContractors.length === 0 ? (
            <p className="text-sm text-gray-600">Loading contractors...</p>
          ) : (
            <div className="table-resize overflow-auto">
              <table className="summary-table min-w-full text-xs md:text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="w-8">✓</th>
                    <th>Contractor</th>
                    <th>Method</th>
                    <th>Account</th>
                    <th>City</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th className="text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {activeContractors.map((c) => {
                    const done = !!sessionDone[c.id];
                    const amount = sessionDone[c.id]?.amount || 0;
                    return (
                      <tr key={c.id} className={done ? "bg-emerald-50/60" : "bg-white"}>
                        <td>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-emerald-600"
                            checked={done}
                            onChange={() => toggleDone(c.id)}
                            aria-label={`Mark ${c.name} done`}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => onContractorOpen(c)}
                            className="text-left font-medium text-gray-900 hover:underline"
                          >
                            {c.name}
                          </button>
                        </td>
                        <td className="text-gray-600">{c.paymentInfo?.method || "—"}</td>
                        <td className="text-gray-600">{c.paymentInfo?.accountLastFour ? `****${c.paymentInfo.accountLastFour}` : "—"}</td>
                        <td className="text-gray-600">{c.address?.city || "—"}</td>
                        <td className="text-right tabular-nums">{done ? formatUSD(amount) : "—"}</td>
                        <td>
                          <span className={`text-xs ${done ? "text-emerald-700 font-medium" : "text-gray-400"}`}>{done ? "✓ Done" : "Pending"}</span>
                        </td>
                        <td className="text-right">
                          <button type="button" onClick={() => onContractorOpen(c)} className="btn-outline text-xs py-0.5 px-2">
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary actions */}
      <SessionSummary {...summary} />
    </div>
  );
};

export default SessionTracker;
