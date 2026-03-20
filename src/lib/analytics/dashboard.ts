"use client";

import { getPayStatementsClient } from "@/lib/data/payStatements";
import { getDataClient } from "@/lib/data";
import { getAvailablePayPeriods, PayPeriod } from "@/utils/payPeriods";
import { getContractorByName } from "@/data/contractorDatabase";
import type { PayStatementData } from "@/types/payStatement";

export type NormalizedStatement = {
  key: string;
  contractorId?: string;
  contractorName: string;
  payPeriodId: string; // app pay period id
  total: number; // dollars
};

export type PeriodTotals = Record<string, number>; // payPeriodId -> total
export type ContractorPeriodMap = Record<string, Record<string, number>>; // contractorId -> (payPeriodId -> total)

/** Load all statements and normalize shape across local and Supabase backends. */
export async function loadNormalizedStatements(): Promise<NormalizedStatement[]> {
  const ps = getPayStatementsClient();
  const list = await ps.listAll();
  const out: NormalizedStatement[] = [];
  for (const row of list) {
    let data: PayStatementData | null = row.data || null;
    if (!data) {
      try {
        data = await ps.load(row.key);
      } catch {
        // Ignore load errors for now, continue
        continue;
      }
    }
    if (!data) continue;
    const contractorId = row.contractorId || getContractorByName(data.paidTo.name)?.id;
    const payPeriodId = data.payment?.payPeriodId || "";
    const total = Number(data.totalPayment || 0);
    if (!payPeriodId) continue; // cannot aggregate without a period id
    out.push({ key: row.key, contractorId, contractorName: data.paidTo.name, payPeriodId, total });
  }
  return out;
}

export function orderVisiblePeriods(): PayPeriod[] {
  // Use available periods to maintain a consistent order for charts/tables
  return getAvailablePayPeriods();
}

export function computePeriodTotals(items: NormalizedStatement[]): PeriodTotals {
  const totals: PeriodTotals = {};
  for (const s of items) {
    totals[s.payPeriodId] = (totals[s.payPeriodId] || 0) + s.total;
  }
  return totals;
}

export function computeContractorByPeriod(items: NormalizedStatement[]): ContractorPeriodMap {
  const map: ContractorPeriodMap = {};
  for (const s of items) {
    const cid = s.contractorId || s.contractorName; // fallback to name as key if id missing
    if (!map[cid]) map[cid] = {};
    map[cid][s.payPeriodId] = (map[cid][s.payPeriodId] || 0) + s.total;
  }
  return map;
}

export function lastNPeriods(n: number): PayPeriod[] {
  const periods = orderVisiblePeriods();
  // visible is ascending by generation; pick last n
  return periods.slice(-n);
}

export function rollingAverage(values: number[], n = 3): number {
  const last = values.slice(-n);
  if (last.length === 0) return 0;
  return last.reduce((a, b) => a + b, 0) / last.length;
}

export function weightedAverage(values: number[], weights: number[]): number {
  if (!values.length || values.length !== weights.length) return 0;
  const wsum = values.reduce((sum, v, i) => sum + v * (weights[i] || 0), 0);
  const wtot = weights.reduce((a, b) => a + b, 0) || 1;
  return wsum / wtot;
}

export function rollingWeightedAverageLastN(values: number[], n = 3, weights = [1, 2, 3]): number {
  const last = values.slice(-n);
  const w = weights.slice(-last.length);
  return weightedAverage(last, w);
}

export async function loadContractorIndex(): Promise<Record<string, string>> {
  // Attempt to load active contractors and build an id->name index; also map name->name for fallback keys
  const dc = getDataClient();
  const index: Record<string, string> = {};
  try {
    const list = await dc.listActiveContractors();
    for (const c of list) index[c.id] = c.name;
  } catch {
    // ignore
  }
  return index;
}

export function topContractorsLastNWithNames(map: ContractorPeriodMap, contractorIndex: Record<string, string>, n = 6) {
  const periods = lastNPeriods(n).map((p) => p.id);
  const entries = Object.entries(map).map(([cid, byP]) => {
    const total = periods.reduce((sum, pid) => sum + (byP[pid] || 0), 0);
    const name = contractorIndex[cid] || cid;
    return { contractorId: cid, name, total };
  });
  entries.sort((a, b) => b.total - a.total);
  return entries;
}

export function computeContractorProjections(contractorMap: ContractorPeriodMap, contractorIndex: Record<string, string>, n = 3) {
  const periods = orderVisiblePeriods().map(p => p.id);
  const results: { contractorId: string; name: string; projectedTotal: number }[] = [];
  for (const [cid, byP] of Object.entries(contractorMap)) {
    const series = periods.filter(id => byP[id] != null).map(id => byP[id] || 0);
    if (!series.length) continue;
    const proj = rollingWeightedAverageLastN(series, n, [1,2,3]);
    const name = contractorIndex[cid] || cid;
    results.push({ contractorId: cid, name, projectedTotal: proj });
  }
  results.sort((a, b) => b.projectedTotal - a.projectedTotal);
  return results;
}


export function projectUpcoming(periodTotals: PeriodTotals, count = 4) {
  const periods = orderVisiblePeriods();
  const knownIds = periods.map((p) => p.id).filter((id) => periodTotals[id] != null);
  const series = knownIds.map((id) => periodTotals[id] || 0);
  const proj = rollingAverage(series, 3);
  const upcoming = periods.filter((p) => periodTotals[p.id] == null).slice(0, count);
  return upcoming.map((p) => ({ id: p.id, label: p.label, projectedTotal: proj }));
}

// Deprecated: use topContractorsLastNWithNames instead for display-friendly rows
export function topContractorsLastN(map: ContractorPeriodMap, n = 6) {
  const periods = lastNPeriods(n).map((p) => p.id);
  const entries = Object.entries(map).map(([cid, byP]) => {
    const total = periods.reduce((sum, pid) => sum + (byP[pid] || 0), 0);
    return { contractorId: cid, total };
  });
  entries.sort((a, b) => b.total - a.total);
  return entries;
}

/**
 * Compute exceptions:
 * - missing statements for active contractors in last closed period
 * - >50% swings for contractor totals between last two periods that exist
 */
export async function computeExceptions(map: ContractorPeriodMap) {
  const dc = getDataClient();
  let active = [] as { id: string; name: string }[];
  try {
    const list = await dc.listActiveContractors();
    active = list.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    active = [];
  }
  const idToName: Record<string, string> = Object.fromEntries(active.map(a => [a.id, a.name]));
  const periods = orderVisiblePeriods();
  const last = periods.slice(-2); // [prev, current/upcoming]
  const lastClosed = last[0];
  const missing: { contractorId: string; name: string }[] = [];
  if (lastClosed) {
    for (const c of active) {
      const key = map[c.id] ? c.id : c.name; // match fallback
      const has = !!(map[key] && map[key][lastClosed.id] != null);
      if (!has) missing.push({ contractorId: c.id, name: c.name });
    }
  }
  const swings: { contractorId: string; name: string; pct: number; from: number; to: number }[] = [];
  const prev = lastClosed?.id;
  const cur = periods[periods.length - 1]?.id;
  if (prev && cur && prev !== cur) {
    for (const [cid, byP] of Object.entries(map)) {
      const a = byP[prev] || 0;
      const b = byP[cur] || 0;
      if (a === 0 && b === 0) continue;
      const base = a || b; // avoid divide-by-zero
      if (base === 0) continue;
      const pct = (b - a) / base;
      if (Math.abs(pct) >= 0.5) {
        swings.push({ contractorId: cid, name: idToName[cid] || cid, pct, from: a, to: b });
      }
    }
  }
  return { missing, swings };
}

export function buildKpis(periodTotals: PeriodTotals) {
  const periods = orderVisiblePeriods();
  const ids = periods.map((p) => p.id);
  const curId = ids[ids.length - 1];
  const prevId = ids[ids.length - 2];
  const curTotal = (periodTotals[curId] || 0);
  const prevTotal = (prevId ? periodTotals[prevId] : 0) || 0;
  const series = ids.filter((id) => periodTotals[id] != null).map((id) => periodTotals[id] || 0);
  const avg3 = rollingAverage(series, 3);
  const varianceVsAvg3 = avg3 === 0 ? 0 : (curTotal - avg3) / avg3;
  return { curId, prevId, curTotal, prevTotal, avg3, varianceVsAvg3 };
}

export async function loadDashboardData() {
  const items = await loadNormalizedStatements();
  const periodTotals = computePeriodTotals(items);
  const contractorByPeriod = computeContractorByPeriod(items);
  const contractorIndex = await loadContractorIndex();
  const kpis = buildKpis(periodTotals);
  const trendPeriods = lastNPeriods(12);
  const trend = trendPeriods.map((p) => ({ id: p.id, label: p.label, total: periodTotals[p.id] || 0 }));
  const topContractors = topContractorsLastNWithNames(contractorByPeriod, contractorIndex, 6).slice(0, 10);
  const projections = projectUpcoming(periodTotals, 6);
  const projectedTopContractors = computeContractorProjections(contractorByPeriod, contractorIndex, 3).slice(0, 10);
  const exceptions = await computeExceptions(contractorByPeriod);
  return { periodTotals, contractorByPeriod, kpis, trend, topContractors, projections, projectedTopContractors, exceptions };
}

// Optional: Supabase server-side aggregation for period totals
export async function fetchSupabasePeriodAgg(): Promise<Record<string, number>> {
  try {
    // Dynamically import to avoid bundling when not using supabase
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("pay_statements")
      .select("period_end,total_cents")
      .order("period_end", { ascending: true });
    if (error) throw error;
    const byEnd: Record<string, number> = {};
    const rows: { period_end: string; total_cents: number | null }[] = (data as { period_end: string; total_cents: number | null }[]) || [];
    for (const row of rows) {
      const end = row.period_end;
      const total = (row.total_cents ?? 0) / 100;
      byEnd[end] = (byEnd[end] || 0) + total;
    }
    return byEnd;
  } catch {
    return {};
  }
}


