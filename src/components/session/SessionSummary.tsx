"use client";

import React, { useState } from "react";
import { formatUSD } from "@/utils/format";

export interface SummaryEntry {
  id: string;
  name: string;
  amount: number;
}

export interface SessionSummaryProps {
  currentPeriodLabel: string;
  totalPaid: number;
  numStatements: number;
  completedEntries: SummaryEntry[];
  onClear: () => void;
  onDownloadPdf: () => void;
  onExportCsv: () => void;
  onEmailAll?: () => void; // new optional handler
}

const SessionSummary: React.FC<SessionSummaryProps> = ({
  currentPeriodLabel,
  totalPaid,
  numStatements,
  completedEntries,
  onClear,
  onDownloadPdf,
  onExportCsv,
  onEmailAll,
}) => {
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleClearClick = () => setConfirmingClear(true);
  const handleClearConfirm = () => { onClear(); setConfirmingClear(false); };
  const handleClearCancel = () => setConfirmingClear(false);

  return (
    <div className="mt-4 w-full p-3 app-panel soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="section-title text-sm text-gray-900">Session Summary</div>
          <div className="text-xs text-gray-600 mt-0.5">
            Pay Period: <span className="text-gray-900 font-medium">{currentPeriodLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
          {confirmingClear ? (
            <>
              <span className="text-xs text-red-700 font-medium">Clear all session data?</span>
              <button onClick={handleClearConfirm} className="btn-ghost text-xs md:text-sm text-red-700 border-red-300">Yes, clear</button>
              <button onClick={handleClearCancel} className="btn-outline text-xs md:text-sm">Cancel</button>
            </>
          ) : (
            <button onClick={handleClearClick} className="btn-ghost text-xs md:text-sm">Clear</button>
          )}
          <button onClick={onDownloadPdf} className="btn-outline text-xs md:text-sm">Download PDF</button>
          <button onClick={onExportCsv} className="btn-outline text-xs md:text-sm">Export CSV</button>
          <button onClick={onEmailAll} className="btn-outline text-xs md:text-sm">Send All via Email</button>
        </div>
      </div>
      <div id="session-summary" className="mt-3">
        <div className="grid grid-cols-2 gap-y-1 text-sm text-gray-800">
          <div className="text-gray-600">Total Paid</div>
          <div className="text-right font-semibold">{formatUSD(totalPaid)}</div>
          <div className="text-gray-600">Statements</div>
          <div className="text-right font-medium">{numStatements}</div>
        </div>
        {numStatements > 0 && (
          <div className="mt-2 space-y-1">
            {completedEntries
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((e) => (
                <div key={e.id} className="flex justify-between text-xs text-gray-800">
                  <span>{e.name}</span>
                  <span>{formatUSD(e.amount)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {confirmingClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-700 font-medium">Are you sure?</span>
            <button onClick={handleClearConfirm} className="text-xs text-red-700 underline hover:text-red-900">Yes, clear</button>
            <button onClick={handleClearCancel} className="text-xs text-gray-600 underline hover:text-gray-800">Cancel</button>
          </div>
        ) : (
          <button onClick={handleClearClick} className="text-xs text-gray-600 hover:text-gray-800 underline">Clear session</button>
        )}
      </div>
    </div>
  );
};

export default SessionSummary;
