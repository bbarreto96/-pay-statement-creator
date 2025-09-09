"use client";

import React, { useState } from "react";
import { PayStatementData } from "@/types/payStatement";
import { getPayStatementsClient } from "@/lib/data/payStatements";

interface Props {
  data: PayStatementData;
}

const SaveStatementButton: React.FC<Props> = ({ data }) => {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const client = getPayStatementsClient();
      const defaultName = `${data.paidTo.name} - ${new Date().toLocaleDateString()}`;
      const key = await client.save(defaultName, data);
      if (!key) throw new Error("Save failed");
      setMessage("Saved successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(`Save error: ${msg}`);
    } finally {
      setSaving(false);
      // Auto clear message after a short delay
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={handleSave}
        disabled={saving}
        className={`px-6 py-3 rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          saving ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
        }`}
        title="Save this pay statement to Supabase"
      >
        💾 {saving ? "Saving..." : "Save Statement"}
      </button>
      {message && (
        <span className="text-sm text-gray-700" role="status">
          {message}
        </span>
      )}
    </div>
  );
};

export default SaveStatementButton;

