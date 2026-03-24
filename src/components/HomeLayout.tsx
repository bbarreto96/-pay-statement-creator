"use client";

import React, { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import ContractorSelector from "@/components/ContractorSelector";
import ContractorManager from "@/components/ContractorManager";
import PayStatementForm from "@/components/PayStatementForm";
import PDFGenerator from "@/components/PDFGenerator";
import SessionTracker from "@/components/session/SessionTracker";
import EmailAllModal from "@/components/session/EmailAllModal";

import { Contractor } from "@/types/contractor";
import { PayStatementData } from "@/types/payStatement";
import { getDefaultPayPeriod, getPayPeriodById } from "@/utils/payPeriods";
import { getDataClient } from "@/lib/data";
import { getPayStatementsClient } from "@/lib/data/payStatements";
import { formatUSD } from "@/utils/format";
import { getSessionsStore } from "@/lib/sessions";
import { getCompanyConfig } from "@/lib/companyConfig";

import { usePayPeriod } from "@/contexts/PayPeriodContext";
/**
 * HomeLayout implements the IA described in docs/HOME_PAGE_GAMEPLAN.md
 * - TopBar: Home/Settings, Pay Period selector
 * - Left rail: Subcontractor selection
 * - Main workspace: Jobs & Summary (PayStatementForm) and Preview/PDF
 * - Right drawer (future): Batch queue (not implemented in this first pass)
 */
const HomeLayout: React.FC = () => {
	const [selectedContractor, setSelectedContractor] =
		useState<Contractor | null>(null);
	const [payStatementData, setPayStatementData] =
		useState<PayStatementData | null>(null);
	const [showPreview, setShowPreview] = useState(false);
		const [emailModalOpen, setEmailModalOpen] = useState(false);
		const [saveState, setSaveState] = useState<{
			status: "idle" | "saving" | "saved" | "error";
			message?: string;
		}>({ status: "idle" });

	const [showContractorManager, setShowContractorManager] = useState(false);
	const defaultPeriod = getDefaultPayPeriod();

	const [payPeriodId, setPayPeriodId] = usePayPeriod();

		// Selected layout preset for PayStatement preview and exports
		const [payStatementPreset, setPayStatementPreset] = useState<"current" | "bpv1">("bpv1");


		// Active contractors for session checklist
		const [activeContractors, setActiveContractors] = useState<Contractor[]>([]);
		const [contractorsLoading, setContractorsLoading] = useState(true);

		// Session is scoped per pay period: key = `pay-session-progress:${payPeriodId}`
		const storageKeyForPeriod = (id: string) => `pay-session-progress:${id || "_none"}`;
		const sessionsStore = useMemo(() => getSessionsStore(), []);

			// Preserve last known amounts per pay period when items are temporarily unchecked
			const lastAmountsKeyForPeriod = (id: string) => `pay-session-last-amounts:${id || "_none"}`;

		const [syncBackend, setSyncBackend] = useState<"supabase" | "local">(sessionsStore.kind);

			// Cache of last amounts by contractor for re-check restores
			const [lastAmounts, setLastAmounts] = useState<Record<string, number>>(() => {
				try {
					if (typeof window === "undefined") return {};
					const raw = localStorage.getItem(lastAmountsKeyForPeriod(payPeriodId));
					return raw ? JSON.parse(raw) : {};
				} catch {
					return {};
				}
			});

	const [syncState, setSyncState] = useState<"idle" | "loading" | "saving" | "error">("idle");

	// Session progress for CURRENT pay period only
	const [sessionDone, setSessionDone] = useState<Record<string, { name: string; amount: number; payPeriodId: string }>>(() => ({}));

	// Draft autosave (local only) keyed by contractor + pay period
	const draftKeyForPeriod = (contractorId: string, periodId: string) =>
		`pay-statement-draft:${contractorId}:${periodId || "_none"}`;
	const loadDraft = React.useCallback((contractorId: string, periodId: string) => {
		try {
			if (typeof window === "undefined") return null;
			const raw = localStorage.getItem(draftKeyForPeriod(contractorId, periodId));
			if (!raw) return null;
			const parsed = JSON.parse(raw) as { data?: PayStatementData } | null;
			return parsed?.data || null;
		} catch {
			return null;
		}
	}, []);
	const saveDraft = React.useCallback(
		(contractorId: string, periodId: string, data: PayStatementData) => {
			try {
				if (typeof window === "undefined") return;
				const payload = { data, updatedAt: Date.now() };
				localStorage.setItem(
					draftKeyForPeriod(contractorId, periodId),
					JSON.stringify(payload)
				);
			} catch {}
		},
		[]
	);
	const clearDraft = React.useCallback((contractorId: string, periodId: string) => {
		try {
			if (typeof window === "undefined") return;
			localStorage.removeItem(draftKeyForPeriod(contractorId, periodId));
		} catch {}
	}, []);

	// Ref to suppress spurious saves while a session load is in flight
	const isLoadingSessionRef = React.useRef(false);

	// When pay period changes, load that period's session from store (Supabase or local)
	useEffect(() => {
		let cancelled = false;
		isLoadingSessionRef.current = true;
		// Reset immediately so stale data from the previous period doesn't flash
		setSessionDone({});
		setSyncState("loading");
		(async () => {
				try {
					const map = await sessionsStore.load(payPeriodId);
					if (!cancelled) {
						setSessionDone(map);
						// Prime lastAmounts cache from loaded session amounts
						const la: Record<string, number> = {};
						for (const [id, v] of Object.entries(map)) {
							la[id] = (v as { amount?: number }).amount ?? 0;
						}
						setLastAmounts(la);
						setSyncBackend(sessionsStore.kind);
						setSyncState("idle");
					}
				} catch (e) {
					console.error("Session load failed, falling back to local", e);
					try {
						if (typeof window !== "undefined") {


							const raw = localStorage.getItem(storageKeyForPeriod(payPeriodId));
							if (!cancelled) setSessionDone(raw ? JSON.parse(raw) : {});
						}
					} catch {
						if (!cancelled) setSessionDone({});
					}
					if (!cancelled) {
						setSyncBackend("local");
						setSyncState("error");
					}
				} finally {
					if (!cancelled) isLoadingSessionRef.current = false;
				}
			})();
			return () => {
				cancelled = true;
				isLoadingSessionRef.current = false;
			};
		}, [sessionsStore, payPeriodId]);

		// Load active contractors for checklist
		const fetchActiveContractors = React.useCallback(async () => {
			try {
				const dc = getDataClient();
				const list = await dc.listActiveContractors();
				const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
				setActiveContractors(sorted);
			} catch (e) {
				console.error("Failed to load active contractors", e);
			} finally {
				setContractorsLoading(false);
			}
		}, []);
		useEffect(() => {
			void fetchActiveContractors();
		}, [fetchActiveContractors]);

		// Keep selected contractor in sync with latest data
    useEffect(() => {
        if (!selectedContractor) return;
        const updated = activeContractors.find((c) => c.id === selectedContractor.id);
        if (updated) setSelectedContractor(updated);
    }, [activeContractors, selectedContractor]);

		// Persist session progress for the current pay period
		// Debounced, guarded save to reduce churn and avoid overlapping writes
		const savingRef = React.useRef(false);
		const pendingRef = React.useRef(false);
		const doPersistLocal = React.useCallback(() => {
			try {
				if (typeof window !== "undefined") {
					localStorage.setItem(storageKeyForPeriod(payPeriodId), JSON.stringify(sessionDone));
				}
			} catch {}
		}, [payPeriodId, sessionDone]);
		const doSave = React.useCallback(async () => {
			// Don't save while a session load is in flight — the changed sessionDone
			// is coming from the load itself, not from a user action.
			if (isLoadingSessionRef.current) return;
			if (savingRef.current) {
				pendingRef.current = true;
				return;
			}
			savingRef.current = true;
			try {
				setSyncState("saving");
				await sessionsStore.save(payPeriodId, sessionDone);
				setSyncBackend(sessionsStore.kind);
				setSyncState("idle");
			} catch (e) {
				console.error("Session save failed; writing local fallback", e);
				setSyncBackend("local");
				setSyncState("error");
			} finally {
				doPersistLocal();
				savingRef.current = false;
				if (pendingRef.current) {
					pendingRef.current = false;
					// schedule next save
					void doSave();
				}
			}
		}, [sessionsStore, payPeriodId, sessionDone, doPersistLocal]);
		useEffect(() => {
			const t = setTimeout(() => { void doSave(); }, 400);
			return () => clearTimeout(t);
		}, [doSave]);
		const retrySync = React.useCallback(() => { void doSave(); }, [doSave]);

		const markCurrentAsDone = () => {
			if (!selectedContractor || !payStatementData) return;
			const amount = payStatementData.totalPayment || 0;
			const periodId = payStatementData.payment.payPeriodId || payPeriodId || "";
			// Update session map
			setSessionDone((prev) => ({
				...prev,
				[selectedContractor.id]: {
					name: selectedContractor.name,
					amount,
					payPeriodId: periodId,
				},
			}));
			// Remember last amount for potential uncheck/re-check
			setLastAmounts((prev) => ({ ...prev, [selectedContractor.id]: amount }));
		};

		const openContractor = React.useCallback(
			(c: Contractor) => {
				setSelectedContractor(c);
				setPayStatementData(null);
				setShowPreview(false);
				// Attempt to auto-load saved statement for this contractor and current pay period
				void (async () => {
					try {
						// Only use local draft when NOT on Supabase — on Supabase always load fresh
						// so both users see the same data without needing a page refresh.
						const isSupabase = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase";
						if (!isSupabase) {
							const draft = loadDraft(c.id, payPeriodId || "");
							if (draft) {
								setPayStatementData(draft);
								return;
							}
						}
						const client = getPayStatementsClient();
						const list = await client.listByContractorId(c.id);
						let matchedKey: string | null = null;
						for (const s of list) {
							if (
								s.data?.payment?.payPeriodId &&
								s.data.payment.payPeriodId === (payPeriodId || "")
							) {
								matchedKey = s.key;
								break;
							}
						}
						if (!matchedKey) {
							const period = getPayPeriodById(payPeriodId || "");
							if (period) {
								const byEndDate = list.find(
									(s) => s.dateISO === period.endDate
								);
								if (byEndDate) matchedKey = byEndDate.key;
							}
						}
						if (!matchedKey && list.length > 0) matchedKey = list[0].key;
						if (matchedKey) {
							const data = await client.load(matchedKey);
							if (data) {
								const next = { ...data };
								if (
									(payPeriodId || "") &&
									next.payment?.payPeriodId !== (payPeriodId || "")
								) {
									next.payment = { ...next.payment, payPeriodId };
								}
								setPayStatementData(next);
							}
						}
					} catch (e) {
						try {
							console.warn("Auto-load on contractor select failed", c.id, e);
						} catch {}
					}
				})();
			},
			[payPeriodId, loadDraft]
		);

		const selectedIndex = selectedContractor
			? activeContractors.findIndex((c) => c.id === selectedContractor.id)
			: -1;
		const goNext = () => {
			if (selectedIndex < 0) return;
			const next = activeContractors[selectedIndex + 1];
			if (next) openContractor(next);
		};
		const goPrev = () => {
			if (selectedIndex < 0) return;
			const prev = activeContractors[selectedIndex - 1];
			if (prev) openContractor(prev);
		};

		const saveStatement = async (opts?: { markDone?: boolean; goNext?: boolean }) => {
			if (!payStatementData || !selectedContractor) return;
			setSaveState({ status: "saving" });
			try {
				const client = getPayStatementsClient();
				const periodLabel =
					getPayPeriodById(payStatementData.payment.payPeriodId)?.label ||
					new Date().toLocaleDateString();
				const defaultName = `${payStatementData.paidTo.name} - ${periodLabel}`;
				const key = await client.save(defaultName, payStatementData);
				if (!key) throw new Error("Save failed");
				setSaveState({ status: "saved", message: "Saved!" });
				// Clear any local draft for this contractor + pay period
				const periodId = payStatementData.payment.payPeriodId || payPeriodId || "";
				clearDraft(selectedContractor.id, periodId);
				if (opts?.markDone) markCurrentAsDone();
				if (opts?.goNext) goNext();
				setTimeout(() => setSaveState({ status: "idle" }), 2500);
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: (err as { message?: string })?.message ||
						  (err as { details?: string })?.details ||
						  JSON.stringify(err);
				setSaveState({ status: "error", message: msg });
			}
		};

		const toggleDone = (id: string) => {
			setSessionDone((prev) => {
				const next = { ...prev } as Record<string, { name: string; amount: number; payPeriodId: string }>;
				if (next[id]) {
					// Unchecking: remember amount, then remove from session map
					const amt = next[id]?.amount ?? 0;
					setLastAmounts((prevLA) => ({ ...prevLA, [id]: amt }));
					delete next[id];
				} else {
					// Re-checking: restore last known amount if available
					const c = activeContractors.find((c) => c.id === id);
					if (c) next[id] = { name: c.name, amount: lastAmounts[id] ?? 0, payPeriodId };
				}
				return next;
			});
		};

		const clearSession = async () => {
			try {
				await sessionsStore.clear(payPeriodId);
			} catch (e) {
				console.error("Session clear failed; clearing local fallback", e);
			} finally {
				if (typeof window !== "undefined") {
					try {
						localStorage.removeItem(storageKeyForPeriod(payPeriodId));
						localStorage.removeItem(lastAmountsKeyForPeriod(payPeriodId));
					} catch {}
				}
				setSessionDone({});
				setLastAmounts({});
			}
		};

		// Select all / Deselect all for current period
		const allSelected = activeContractors.length > 0 && Object.keys(sessionDone).length === activeContractors.length;
		const selectAll = () => {
			const map: Record<string, { name: string; amount: number; payPeriodId: string }> = {};
			for (const c of activeContractors) {
				map[c.id] = { name: c.name, amount: lastAmounts[c.id] ?? 0, payPeriodId };
			}
			setSessionDone(map);
		};
		const deselectAll = () => {
			// Preserve all current amounts into cache, then clear selections
			setLastAmounts((prevLA) => {
				const merged = { ...prevLA } as Record<string, number>;
				for (const [id, v] of Object.entries(sessionDone)) {
					merged[id] = (v as { amount?: number }).amount ?? 0;
				}
				return merged;
			});
			setSessionDone({});
		};

		// Progress
		const completed = Object.keys(sessionDone).length;
		const percentComplete = activeContractors.length
			? Math.round((completed / activeContractors.length) * 100)
			: 0;


			// When pay period changes, load lastAmounts cache for that period
			useEffect(() => {
				try {
					if (typeof window === "undefined") return;
					const raw = localStorage.getItem(lastAmountsKeyForPeriod(payPeriodId));
					setLastAmounts(raw ? JSON.parse(raw) : {});
				} catch {
					setLastAmounts({});
				}
			}, [payPeriodId]);

			// Persist lastAmounts cache to localStorage
			useEffect(() => {
				try {
					if (typeof window === "undefined") return;
					localStorage.setItem(lastAmountsKeyForPeriod(payPeriodId), JSON.stringify(lastAmounts));
				} catch {}
			}, [payPeriodId, lastAmounts]);

		// Derived session summary (current period only)
		const completedEntries = Object.entries(sessionDone).map(([id, v]) => ({ id, ...v }));
		const totalPaid = completedEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
		const numStatements = completedEntries.length;
		const currentPeriodLabel = getPayPeriodById(payPeriodId)?.label || payPeriodId;

		// Print/download summary as a professionally formatted PDF
		const downloadSummaryPdf = () => {
			const esc = (s: string) => String(s)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;");
			const now = new Date();
			const generatedAt = now.toLocaleString();
			const rows = completedEntries
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((e) => `
					<tr>
						<td class="name">${esc(e.name)}</td>
						<td class="amount">${esc(formatUSD(e.amount || 0))}</td>
						<td class="status">✓</td>
					</tr>
				`)
				.join("");
			const w = window.open("", "_blank");
			if (!w) return;
			w.document.write(`<!doctype html>
			<html>
			<head>
			<meta charset="utf-8" />
			<title>Pay Statement Session Summary</title>
			<style>
			  @page { margin: 18mm; }
			  :root { --ink:#0b0b0b; --sub:#555; --grid:#dcdcdc; --zebra:#fafafa; }
			  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--ink); }
			  .wrap { max-width: 960px; margin: 0 auto; }
			  h1 { font-size: 22px; margin: 0 0 10px; }
			  .meta { color: var(--sub); font-size: 12px; margin-bottom: 16px; }
			  .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 12px 0 18px; font-size: 14px; }
			  .summary .label { color: var(--sub); }
			  .summary .value { font-weight: 600; text-align: right; }
			  table { width: 100%; border-collapse: collapse; font-size: 13px; }
			  th, td { border: 1px solid var(--grid); padding: 8px 10px; }
			  th { background: #f3f4f6; text-align: left; font-weight: 700; }
			  tbody tr:nth-child(odd) { background: var(--zebra); }
			  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
			  td.status { text-align: center; font-weight: 700; }
			</style>
			</head>
			<body>
			  <div class="wrap">
			    <h1>Pay Statement Session Summary</h1>
			    <div class="meta">Pay Period: <strong>${esc(currentPeriodLabel)}</strong> · Generated: ${esc(generatedAt)}</div>
			    <div class="summary">
			      <div class="label">Total Paid</div><div class="value">${esc(formatUSD(totalPaid))}</div>
			      <div class="label">Statements</div><div class="value">${numStatements}</div>
			    </div>
			    <table>
			      <thead>
			        <tr>
			          <th style="width:60%">Contractor Name</th>
			          <th style="width:25%">Payment Amount</th>
			          <th style="width:15%">Status</th>
			        </tr>
			      </thead>
			      <tbody>
			        ${rows || `<tr><td colspan="3" style="text-align:center; color: var(--sub); padding: 16px;">No statements recorded for this pay period.</td></tr>`}
			      </tbody>
			    </table>
			  </div>
			</body>
			</html>`);
			w.document.close();
			w.focus();
			// Give the browser a moment to render before printing
			setTimeout(() => { try { w.print(); } catch {} }, 50);
			setTimeout(() => { try { w.close(); } catch {} }, 200);
		};
			// Export summary as CSV
			const exportSummaryCsv = () => {
				const header = ["Contractor Name","Payment Amount","Status"];
				const rows = completedEntries
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((e) => [e.name, (e.amount || 0).toFixed(2), "Done"]);
				const data = [header, ...rows]
					.map((r) => r.map((v) => {
						const s = String(v ?? "");
						return s.includes(",") || s.includes("\n") || s.includes("\"")
							? `"${s.replaceAll("\"", '""')}"`
							: s;
					}).join(","))
					.join("\n");
				const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `session-summary-${currentPeriodLabel.replaceAll(' ', '-')}.csv`;
				document.body.appendChild(a);
				a.click();
				setTimeout(() => {
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				}, 0);
			};



	// Keep preview data in sync if the pay period changes via TopBar
	useEffect(() => {
        setPayStatementData((prev) => {
            if (!prev) return prev;
            if (prev.payment.payPeriodId === payPeriodId) return prev;
            return { ...prev, payment: { ...prev.payment, payPeriodId } };
        });
	}, [payPeriodId]);

		// When pay period changes (TopBar) and a contractor is selected, try to auto-load that period's saved statement
		useEffect(() => {
			if (!selectedContractor) return;
			let cancelled = false;
			void (async () => {
				try {
					// Skip local draft on Supabase — always load fresh so both users see the same data
					const isSupabase = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase";
					if (!isSupabase) {
						const draft = loadDraft(selectedContractor.id, payPeriodId || "");
						if (draft) {
							if (!cancelled) setPayStatementData(draft);
							return;
						}
					}
					const client = getPayStatementsClient();
					const list = await client.listByContractorId(selectedContractor.id);
					let matchedKey: string | null = null;
					for (const s of list) {
						if (s.data?.payment?.payPeriodId && s.data.payment.payPeriodId === (payPeriodId || "")) { matchedKey = s.key; break; }
					}
					if (!matchedKey) {
						const period = getPayPeriodById(payPeriodId || "");
						if (period) {
							const byEndDate = list.find((s) => s.dateISO === period.endDate);
							if (byEndDate) matchedKey = byEndDate.key;
						}
					}
					if (!matchedKey && list.length > 0) matchedKey = list[0].key;
					if (matchedKey) {
						const data = await client.load(matchedKey);
						if (!cancelled && data) {
							const next = { ...data };
							if ((payPeriodId || "") && next.payment?.payPeriodId !== (payPeriodId || "")) {
								next.payment = { ...next.payment, payPeriodId };
							}
							setPayStatementData(next);
						}
					}
				} catch (e) {
					try { console.warn("Auto-load on pay period change failed", selectedContractor.id, e); } catch {}
				}
			})();
			return () => { cancelled = true; };
		}, [payPeriodId, selectedContractor, loadDraft]);

		// Autosave drafts (local) whenever data changes
		useEffect(() => {
			if (!selectedContractor || !payStatementData) return;
			const contractorId = selectedContractor.id;
			const periodId = payStatementData.payment?.payPeriodId || payPeriodId || "";
			if (!contractorId) return;
			const t = setTimeout(() => {
				saveDraft(contractorId, periodId, payStatementData);
			}, 350);
			return () => clearTimeout(t);
		}, [selectedContractor, payStatementData, payPeriodId, saveDraft]);
	// If the user changes Pay Period inside the form, reflect it in TopBar
    useEffect(() => {
        if (!payStatementData) return;
        const id = payStatementData.payment.payPeriodId;
        if (id && id !== payPeriodId) setPayPeriodId(id);
    }, [payStatementData, payPeriodId, setPayPeriodId]);
	// When contractor changes, seed the PayStatementForm with defaults for speed
	const initialData: PayStatementData | undefined = useMemo(() => {
		if (!selectedContractor) return undefined;
		const seededDetails = (selectedContractor.buildings || [])
			.filter((b) => b.isActive)
			.map((b) => ({
				description:
					b.buildingName + (b.payType === "hourly" ? " (hourly)" : ""),
				amount:
					(b.payType === "hourly" ? b.hourlyRate || 0 : b.payPerVisit || 0) ||
					0,
			}));
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
				name: selectedContractor.name,
				address: {
					street: selectedContractor.address.street,
					city: selectedContractor.address.city,
					state: selectedContractor.address.state,
					zipCode: selectedContractor.address.zipCode,
				},
			},
			payment: {
				payPeriodId: payPeriodId || defaultPeriod?.id || "",
				method: selectedContractor.paymentInfo.method,
			},
			paymentDetails:
				seededDetails.length > 0
					? seededDetails
					: [{ description: "", amount: 0 }],
			summary: [
				{
					description: "[name of building]",
					payPerVisit: 0,
					numberOfVisits: 0,
					total: 0,
				},
			],
			totalPayment: 0,
			notes: "",
		};
	}, [selectedContractor, defaultPeriod?.id, payPeriodId]);

		return (
		<div className="min-h-screen app-shell">
			<TopBar
				onHomeClick={() => {
					// Reset the Home workspace to initial state
					setSelectedContractor(null);
					setPayStatementData(null);
					setShowPreview(false);
					setShowContractorManager(false);
				}}
			/>
				{process.env.NEXT_PUBLIC_DATA_BACKEND === 'supabase' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && (
					<div className="mx-4 -mt-2 mb-2 p-2 border border-amber-300 bg-amber-50 text-amber-900 rounded text-sm">
						Supabase backend is selected, but credentials are missing. Session progress will be kept locally until configured.
					</div>
				)}

			<div className="max-w-[1600px] mx-auto px-5 py-4 space-y-4">
				{/* Top summary table */}
				<div className="app-panel p-4 rise-in">
					<SessionTracker
						activeContractors={activeContractors}
						sessionDone={sessionDone}
						completed={completed}
						percentComplete={percentComplete}
						allSelected={allSelected}
						toggleDone={toggleDone}
						selectAll={selectAll}
						deselectAll={deselectAll}
						syncState={syncState}
						syncBackend={syncBackend}
						retrySync={retrySync}
						onContractorOpen={openContractor}
						summary={{
							currentPeriodLabel,
							totalPaid,
							numStatements,
							completedEntries,
							onClear: clearSession,
							onDownloadPdf: downloadSummaryPdf,
							onExportCsv: exportSummaryCsv,
							onEmailAll: () => setEmailModalOpen(true),
						}}
					/>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_400px] gap-5">
				{/* Left rail: Contractor selection */}
				<aside>
					<div className="app-panel p-4 rise-in">
						<div className="flex items-center justify-between mb-2">
							<h3 className="section-title text-lg text-black">Contractors</h3>
							<div className="flex items-center gap-1">
								<button
									onClick={() => {
										setContractorsLoading(true);
										void fetchActiveContractors();
										void sessionsStore.load(payPeriodId).then((map) => setSessionDone(map)).catch(() => {});
										if (selectedContractor) openContractor(selectedContractor);
									}}
									className="btn-outline text-xs"
									title="Reload data from server"
								>
									Refresh
								</button>
								<button
									onClick={() => setShowContractorManager(true)}
									className="btn-outline text-xs"
								>
									Manage
								</button>
							</div>
						</div>
						{contractorsLoading ? (
							<div className="py-6 text-center text-sm text-gray-500">Loading contractors…</div>
						) : (
							<ContractorSelector
								selectedContractor={selectedContractor || undefined}
								contractors={activeContractors}
								onContractorSelect={openContractor}
							/>
						)}
							{/* Email modal for sending all PDFs */}
							{emailModalOpen && (
								<EmailAllModal
									open={emailModalOpen}
									onClose={() => setEmailModalOpen(false)}
									periodLabel={currentPeriodLabel}
									payPeriodId={payPeriodId || ""}
									entries={completedEntries}
									contractorsIndex={Object.fromEntries(activeContractors.map((c) => [c.id, c]))}
									payStatementPreset={payStatementPreset}
								/>
							)}

						{/* Legacy tracker hidden after refactor */}

						{/*

						<>


						<div className="mt-4 border-t pt-5">
							<div className="flex items-center justify-between mb-3">
								<div>
									<h4 className="text-base md:text-lg font-semibold text-black">Session Tracker</h4>
									<div className="mt-1 flex items-center gap-2">
										<span className="text-xs md:text-sm text-gray-700 font-medium">{completed} / {activeContractors.length} done · {percentComplete}%</span>
										{syncState === "saving" && (<span className="text-[11px] md:text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Syncing...</span>)}
										{syncState === "error" && (
											<div className="flex items-center gap-2">
												<span title="Falling back to local backup" className="text-[11px] md:text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">Offline (local)</span>
												<button onClick={retrySync} className="text-[11px] md:text-xs px-1.5 py-0.5 rounded border border-amber-300 text-amber-800 hover:bg-amber-50">Retry</button>
											</div>
										)}
										{syncState !== "error" && syncBackend === "supabase" && (<span className="text-[11px] md:text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">Synced</span>)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									<button onClick={allSelected ? deselectAll : selectAll} className="text-xs md:text-sm px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">{allSelected ? "Deselect all" : "Select all"}</button>
								</div>
							</div>
							<div className="mb-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
								<div className="h-full bg-emerald-500" style={{ width: `${percentComplete}%` }} />
							</div>
							{activeContractors.length === 0 ? (
								<p className="text-sm text-gray-600">Loading contractors...</p>
							) : (
								<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
									{activeContractors.map((c) => {
										const done = !!sessionDone[c.id];
										const amount = sessionDone[c.id]?.amount || 0;
										return (
											<div key={c.id} className={`flex items-center justify-between px-2.5 py-2 rounded-md border ${done ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
												<label className="flex items-center gap-3 text-sm md:text-[15px] cursor-pointer select-none">
													<input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={done} onChange={() => toggleDone(c.id)} />
													<span
											className={`text-black underline decoration-transparent hover:decoration-current hover:text-blue-700 ${done ? "font-medium" : ""}`}
											title="Open this contractor in the editor"
											role="button"
											tabIndex={0}
											onClick={(e) => {
												e.preventDefault(); e.stopPropagation();
												setSelectedContractor(c);
												setPayStatementData(null);
												setShowPreview(false);
											}}
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault(); e.stopPropagation();
													setSelectedContractor(c);
													setPayStatementData(null);
													setShowPreview(false);
												}
											}}
										>
											{c.name}
										</span>
												</label>
												<div className="flex items-center gap-2">
													{done && (<span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-white"><path d="M7.629 13.233L4.4 10.004l1.133-1.133 2.096 2.096 6.84-6.84 1.133 1.133-7.973 7.973z"/></svg></span>)}
													<div className="text-xs md:text-sm text-gray-700 tabular-nums min-w-[64px] text-right">{done && amount > 0 ? formatUSD(amount) : ""}</div>
												</div>
											</div>
										);
									})}
								</div>
							) }

							<div className="mt-5 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
								<div className="flex items-center justify-between">
									<div>
										<div className="text-sm font-semibold text-gray-900">Session Summary</div>
										<div className="text-xs text-gray-600 mt-0.5">Pay Period: <span className="text-gray-900 font-medium">{currentPeriodLabel}</span></div>

									</div>
									<div className="flex items-center gap-2">
										<button onClick={clearSession} className="text-xs md:text-sm px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 transition">Clear</button>
										<button onClick={downloadSummaryPdf} className="text-xs md:text-sm px-3 py-1.5 rounded-md bg-gray-900 hover:bg-black text-white focus:outline-none focus:ring-2 focus:ring-gray-400 transition">Download PDF</button>
										<button onClick={exportSummaryCsv} className="text-xs md:text-sm px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-gray-400 transition">Export CSV</button>
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
									<button onClick={clearSession} className="text-xs text-gray-600 hover:text-gray-800 underline">Clear session</button>
								</div>
							</div>

						</div>

						</>

						*/}


					</div>
				</aside>

				{/* Main workspace */}
				<main>
					{!selectedContractor ? (
						<div className="flex items-center justify-center h-64 app-panel rise-in">
							<p className="text-gray-700">Select a contractor to begin.</p>
						</div>
					) : (
						<div className="space-y-4">
							{!showPreview ? (
								<div className="app-panel p-5 rise-in">
									<div className="flex items-center justify-between mb-3">
										<div className="flex items-center gap-3">
											<h2 className="section-title text-2xl text-black">
												{selectedContractor.name}
											</h2>
											<a
												href={`/contractors/${selectedContractor.id}/statements`}
												className="text-xs text-blue-600 hover:underline"
												title="View full pay history for this contractor"
											>
												History →
											</a>
										</div>
										<div className="flex gap-2">
											{payStatementData && (<>
												<button
													onClick={markCurrentAsDone}
													className="btn-outline"
												>
													Mark Done
												</button>

												<button
													onClick={() => setShowPreview(true)}
													className="btn-outline"
												>
													Preview / PDF
												</button>
											</>)}
										</div>
									</div>
													<PayStatementForm
														key={`${selectedContractor?.id || "none"}-${payPeriodId || ""}-${payStatementData ? "loaded" : "seeded"}`}
										// Preserve edits when returning from Preview
										initialData={payStatementData ?? initialData}
										onDataChange={setPayStatementData}
										hideCompanyInfo
										externalPayPeriodId={payPeriodId}
									/>
									<div className="text-right mt-4">
										<button
											onClick={() => setShowPreview(true)}
											className="btn-outline"
										>
											Preview Statement
										</button>
									</div>
								</div>
							) : (
								<div className="app-panel p-4 rise-in">
									<div className="flex items-center justify-between mb-4">
										<button
											onClick={() => setShowPreview(false)}
											className="btn-outline"
										>
											← Back to Edit
										</button>
										<div className="flex items-center gap-2">
									<div className="font-medium text-black">PDF Preview</div>
									{payStatementData && (
										<button onClick={markCurrentAsDone} className="btn-outline text-xs">Mark Done</button>
									)}
								</div>
									</div>
									{payStatementData && (
						<PDFGenerator
								data={payStatementData}
								preset={payStatementPreset}
								onPresetChange={setPayStatementPreset}
							/>
									)}
								</div>
							)}
						</div>
					)}
				</main>

				{/* Right rail: Quick actions + preview */}
				<aside>
					<div className="app-panel p-4 space-y-4 rise-in">
						<div>
							<h3 className="section-title text-lg text-gray-900">Quick Actions</h3>
							<p className="text-xs text-gray-500">Save, mark done, and hop to the next contractor.</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								onClick={() => saveStatement()}
								disabled={!payStatementData || saveState.status === "saving"}
								className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{saveState.status === "saving" ? "Saving…" : "Save"}
							</button>
							<button
								onClick={() => saveStatement({ markDone: true, goNext: true })}
								disabled={!payStatementData || saveState.status === "saving"}
								className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Save + Next
							</button>
							<button
								onClick={markCurrentAsDone}
								disabled={!payStatementData}
								className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Mark Done
							</button>
							<button
								onClick={goPrev}
								disabled={selectedIndex <= 0}
								className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Prev
							</button>
							<button
								onClick={goNext}
								disabled={selectedIndex < 0 || selectedIndex >= activeContractors.length - 1}
								className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Next
							</button>
							<button
								onClick={() => setShowPreview(true)}
								disabled={!payStatementData}
								className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Open PDF
							</button>
						</div>
						{saveState.message && (
							<div
								className={`text-xs px-2 py-1 rounded-md ${
									saveState.status === "error"
										? "bg-red-50 text-red-700 border border-red-200"
										: "bg-emerald-50 text-emerald-700 border border-emerald-200"
								}`}
							>
								{saveState.message}
							</div>
						)}
						<div className="border-t border-gray-100 pt-3">
							<h4 className="section-title text-sm text-gray-800 mb-2">Quick Preview</h4>
							{payStatementData ? (
								<div className="space-y-2 text-xs text-gray-700">
									<div className="flex justify-between">
										<span>Pay period</span>
										<span className="font-medium">
											{getPayPeriodById(payStatementData.payment.payPeriodId)?.label || payStatementData.payment.payPeriodId}
										</span>
									</div>
									<div className="flex justify-between">
										<span>Total</span>
										<span className="font-semibold">{formatUSD(payStatementData.totalPayment || 0)}</span>
									</div>
									<div className="text-[11px] text-gray-500">Preview (first 3 lines)</div>
									<div className="space-y-1">
										{(payStatementData.summary || []).slice(0, 3).map((item, idx) => (
											<div key={idx} className="flex justify-between">
												<span className="truncate max-w-[140px]">{item.description}</span>
												<span>{formatUSD(item.total || 0)}</span>
											</div>
										))}
									</div>
								</div>
							) : (
								<div className="text-xs text-gray-500">Select a contractor to preview.</div>
							)}
						</div>
					</div>
				</aside>

				{/* Right drawer placeholder for batch queue (future) */}
				</div>
			</div>
			{showContractorManager && (
				<ContractorManager
					onClose={() => {
						setShowContractorManager(false);
						void fetchActiveContractors();
					}}
					onSaved={() => {
						void fetchActiveContractors();
					}}
				/>
			)}
		</div>
	);
};

export default HomeLayout;
