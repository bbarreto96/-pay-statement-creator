import { getSupabaseClient } from "@/lib/supabase/client";
import { recordSupabaseError, recordSupabaseWrite } from "@/lib/supabase/status";

export type SessionEntry = { name: string; amount: number; payPeriodId: string };
export type SessionMap = Record<string, SessionEntry>; // contractorId -> entry

export interface SessionsStore {
  kind: "supabase" | "local";
  load(payPeriodId: string): Promise<SessionMap>;
  save(payPeriodId: string, map: SessionMap): Promise<void>;
  clear(payPeriodId: string): Promise<void>;
}

type PaySessionRow = { id: string; pay_period_id: string };
type EntryRow = { contractor_id: string; contractor_name: string; amount: number };

const storageKeyForPeriod = (id: string) => `pay-session-progress:${id || "_none"}`;

class LocalSessionsStore implements SessionsStore {
  kind = "local" as const;
  async load(payPeriodId: string): Promise<SessionMap> {
    try {
      if (typeof window === "undefined") return {};
      const raw = localStorage.getItem(storageKeyForPeriod(payPeriodId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  async save(payPeriodId: string, map: SessionMap): Promise<void> {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(storageKeyForPeriod(payPeriodId), JSON.stringify(map));
    } catch {}
  }
  async clear(payPeriodId: string): Promise<void> {
    try {
      if (typeof window === "undefined") return;
      localStorage.removeItem(storageKeyForPeriod(payPeriodId));
    } catch {}
  }
}

class SupabaseSessionsStore implements SessionsStore {
  kind = "supabase" as const;
  private async ensureSession(payPeriodId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data: existing, error: qErr } = await supabase
      .from("app_pay_sessions")
      .select("id")
      .eq("pay_period_id", payPeriodId)
      .limit(1)
      .maybeSingle();
    if (qErr) throw qErr;
    if (existing?.id) return existing.id as string;
    const { data: created, error: iErr } = await supabase
      .from("app_pay_sessions")
      .insert({ pay_period_id: payPeriodId })
      .select("id")
      .single();
    if (iErr) throw iErr;
    return created!.id as string;
  }

  async load(payPeriodId: string): Promise<SessionMap> {
    const supabase = getSupabaseClient();
    const { data: session, error: sErr } = await supabase
      .from("app_pay_sessions")
      .select("id")
      .eq("pay_period_id", payPeriodId)
      .limit(1)
      .maybeSingle<PaySessionRow>();
    if (sErr) throw sErr;
    if (!session?.id) return {};
    const { data: entries, error: eErr } = await supabase
      .from("app_pay_session_entries")
      .select("contractor_id, contractor_name, amount")
      .eq("session_id", session.id);
    if (eErr) throw eErr;
    const map: SessionMap = {};
    (entries as EntryRow[] | null | undefined)?.forEach((row) => {
      map[row.contractor_id] = {
        name: row.contractor_name,
        amount: Number(row.amount) || 0,
        payPeriodId,
      };
    });
    return map;
  }

  async save(payPeriodId: string, map: SessionMap): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      const sessionId = await this.ensureSession(payPeriodId);
      const rows = Object.entries(map).map(([contractorId, v]) => ({
        session_id: sessionId,
        contractor_id: contractorId,
        contractor_name: v.name,
        amount: v.amount ?? 0,
      }));
      // Try RPC for transactional replace if available
      try {
        const { error: rpcErr } = await supabase.rpc("app_replace_session_entries", {
          p_session_id: sessionId,
          p_rows: rows,
        });
        if (rpcErr) throw rpcErr;
        recordSupabaseWrite();
        return;
      } catch {
        // Fallback to delete+insert when RPC is not present
      }
      const { error: delErr } = await supabase
        .from("app_pay_session_entries")
        .delete()
        .eq("session_id", sessionId);
      if (delErr) throw delErr;
      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from("app_pay_session_entries")
          .insert(rows);
        if (insErr) throw insErr;
      }
      recordSupabaseWrite();
    } catch (err) {
      recordSupabaseError(err);
      throw err;
    }
  }

  async clear(payPeriodId: string): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      const { data: session, error: sErr } = await supabase
        .from("app_pay_sessions")
        .select("id")
        .eq("pay_period_id", payPeriodId)
        .limit(1)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!session?.id) return; // nothing to clear
      const { error: delErr } = await supabase
        .from("app_pay_session_entries")
        .delete()
        .eq("session_id", session.id);
      if (delErr) throw delErr;
      recordSupabaseWrite();
    } catch (err) {
      recordSupabaseError(err);
      throw err;
    }
  }
}

export function getSessionsStore(): SessionsStore {
  const backend = process.env.NEXT_PUBLIC_DATA_BACKEND || "local";
  if (backend === "supabase") {
    try {
      // Validate envs early; will throw if missing
      getSupabaseClient();
      return new SupabaseSessionsStore();
    } catch {
      // fall through to local
    }
  }
  return new LocalSessionsStore();
}
