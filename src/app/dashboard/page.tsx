"use client";

import React, { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import Link from "next/link";
import { loadDashboardData } from "@/lib/analytics/dashboard";
import { getPayPeriodById } from "@/utils/payPeriods";
import { formatUSD } from "@/utils/format";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadDashboardData>> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await loadDashboardData();
        if (mounted) setData(d);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load dashboard";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <TopBar />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <h1 className="section-title text-2xl mb-4">Owner Dashboard</h1>
        {loading && <div className="text-gray-600">Loading…</div>}
        {error && (
          <div className="text-red-600">{error}</div>
        )}
        {!loading && !error && data && (
          <div className="space-y-8">
            {/* Overview KPIs */}
            <section>
              <h2 className="text-lg font-medium mb-3">Overview</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard title="Current Period Total" value={formatUSD(kpis?.curTotal || 0)} subtitle={getPayPeriodById(kpis?.curId || "")?.label || "—"} />
                <KpiCard title="Last Period Total" value={formatUSD(kpis?.prevTotal || 0)} subtitle={getPayPeriodById(kpis?.prevId || "")?.label || "—"} />
                <KpiCard title="3-Period Avg" value={formatUSD(kpis?.avg3 || 0)} subtitle="Rolling average" />
                <KpiCard title="Variance vs Avg" value={`${((kpis?.varianceVsAvg3 || 0) * 100).toFixed(1)}%`} subtitle="Current vs 3-period avg" />
              </div>
            </section>

            {/* Trend: last 12 periods */}
            <section>
              <h2 className="text-lg font-medium mb-3">Payroll Trend (Last 12 Periods)</h2>
              <div className="mb-3">
                <Sparkline points={data.trend.slice(-6).map(r => r.total)} />
                <div className="text-xs text-gray-500 mt-1">Last 6 periods</div>
              </div>
              <TrendTable rows={data.trend} />
            </section>

            {/* Top contractors last 6 periods */}
            <section>
              <h2 className="text-lg font-medium mb-3">Top Contractors (Last 6 Periods)</h2>
              <TopContractorsTable rows={data.topContractors} />
            </section>

            {/* Projections next 4-6 */}
            <section>
              <h2 className="text-lg font-medium mb-3">Cashflow Projections (Next Periods)</h2>
              <ProjectionTable rows={data.projections} />
            </section>

            {/* Projected top contractors next period */}
            <section>
              <h2 className="text-lg font-medium mb-3">Projected Top Contractors (Next Period)</h2>
              <ProjectedTopContractorsTable rows={data.projectedTopContractors} />
            </section>


            {/* Exceptions */}
            <section>
              <h2 className="text-lg font-medium mb-3">Exceptions</h2>
              <ExceptionsPanel exceptions={data.exceptions} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="app-panel p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="section-title text-xl">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function TrendTable({ rows }: { rows: { id: string; label: string; total: number }[] }) {
  if (!rows.length) return <EmptyState message="No statements found yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-2 pr-4">Pay Period</th>
            <th className="py-2 pr-4">Total Paid</th>
            <th className="py-2">Visual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-4 whitespace-nowrap">{r.label}</td>
              <td className="py-2 pr-4">{formatUSD(r.total)}</td>
              <td className="py-2">
                <Bar value={r.total} max={Math.max(...rows.map((x) => x.total), 1)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopContractorsTable({ rows }: { rows: { contractorId: string; name: string; total: number }[] }) {
  if (!rows.length) return <EmptyState message="No contractor history yet." />;
  const canLink = (id: string) => id && !id.includes(" ");
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-2 pr-4">Contractor</th>
            <th className="py-2">Total (last 6)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.contractorId + idx} className="border-t">
              <td className="py-2 pr-4 whitespace-nowrap">
                {canLink(r.contractorId) ? (
                  <Link href={`/contractors/${r.contractorId}/statements`} className="text-blue-600 hover:underline">{r.name || r.contractorId}</Link>
                ) : (
                  <span>{r.name || r.contractorId}</span>
                )}
              </td>
              <td className="py-2">{formatUSD(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectionTable({ rows }: { rows: { id: string; label: string; projectedTotal: number }[] }) {
  if (!rows.length) return <EmptyState message="No upcoming periods available." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-2 pr-4">Upcoming Period</th>
            <th className="py-2">Projected Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-4 whitespace-nowrap">{r.label}</td>
              <td className="py-2">{formatUSD(r.projectedTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectedTopContractorsTable({ rows }: { rows: { contractorId: string; name: string; projectedTotal: number }[] }) {
  if (!rows.length) return <EmptyState message="No projection available yet." />;
  const canLink = (id: string) => id && !id.includes(" ");
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-2 pr-4">Contractor</th>
            <th className="py-2">Projected Next Period</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.contractorId + idx} className="border-t">
              <td className="py-2 pr-4 whitespace-nowrap">
                {canLink(r.contractorId) ? (
                  <Link href={`/contractors/${r.contractorId}/statements`} className="text-blue-600 hover:underline">{r.name || r.contractorId}</Link>
                ) : (
                  <span>{r.name || r.contractorId}</span>
                )}
              </td>
              <td className="py-2">{formatUSD(r.projectedTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExceptionsPanel({ exceptions }: { exceptions: { missing: { contractorId: string; name: string }[]; swings: { contractorId: string; name: string; pct: number; from: number; to: number }[] } }) {
  const { missing, swings } = exceptions;
  if (!missing.length && !swings.length) return <EmptyState message="No exceptions detected." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border rounded-md p-3 bg-white">
        <div className="font-medium mb-2">Missing Statements (last closed period)</div>
        {!missing.length ? (
          <div className="text-sm text-gray-500">None</div>
        ) : (
          <ul className="text-sm list-disc pl-5">
            {missing.map((m) => (
              <li key={m.contractorId}>
                {m.contractorId && !m.contractorId.includes(" ") ? (
                  <Link href={`/contractors/${m.contractorId}/statements`} className="text-blue-600 hover:underline">{m.name}</Link>
                ) : (
                  <span>{m.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border rounded-md p-3 bg-white">
        <div className="font-medium mb-2">Large Swings (&gt;50%)</div>
        {!swings.length ? (
          <div className="text-sm text-gray-500">None</div>
        ) : (
          <ul className="text-sm list-disc pl-5">
            {swings.map((s, idx) => (
              <li key={s.contractorId + idx}>
                {s.name || s.contractorId}: {formatUSD(s.from)} → {formatUSD(s.to)} ({(s.pct * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


function Sparkline({ points }: { points: number[] }) {
  const w = 160, h = 32, pad = 4;
  const vals = points && points.length ? points : [0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  const coords = vals.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = coords.join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <rect x="0" y="0" width={w} height={h} fill="#f9fafb" rx="4" />
      <path d={d} fill="none" stroke="#3b82f6" strokeWidth={2} />
    </svg>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="h-3 bg-gray-100 rounded">
      <div className="h-3 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-sm text-gray-500">{message}</div>;
}
