"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDefaultPayPeriod, getPayPeriodById } from "@/utils/payPeriods";

type Ctx = {
  payPeriodId: string;
  setPayPeriodId: (id: string) => void;
};

const PayPeriodContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "selected-pay-period-id";

export function PayPeriodProvider({ children }: { children: React.ReactNode }) {
  // Initialize empty to ensure SSR/CSR markup matches; hydrate on mount
  const [payPeriodId, setPayPeriodId] = useState<string>("");

  // Hydrate from localStorage or default (client-only)
  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const id = (saved && getPayPeriodById(saved) ? saved : getDefaultPayPeriod()?.id) || "";
      setPayPeriodId(id);
    } catch {}
  }, []);

  // Persist selection
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && payPeriodId) {
        localStorage.setItem(STORAGE_KEY, payPeriodId);
      }
    } catch {}
  }, [payPeriodId]);

  // Sync across tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && typeof e.newValue === "string") {
        const v = e.newValue;
        if (v && v !== payPeriodId && getPayPeriodById(v)) {
          setPayPeriodId(v);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [payPeriodId]);

  const value = useMemo(() => ({ payPeriodId, setPayPeriodId }), [payPeriodId]);
  return <PayPeriodContext.Provider value={value}>{children}</PayPeriodContext.Provider>;
}

export function usePayPeriod(): [string, (id: string) => void] {
  const ctx = useContext(PayPeriodContext);
  if (!ctx) {
    const d = getDefaultPayPeriod()?.id || "";
    return [d, () => {}];
  }
  return [ctx.payPeriodId, ctx.setPayPeriodId];
}

export default PayPeriodContext;

