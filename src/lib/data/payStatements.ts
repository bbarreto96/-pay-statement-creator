"use client";

import { PayStatementData } from "@/types/payStatement";
import {
	deletePayStatement as localDelete,
	getAllSavedStatements as localKeys,
	loadPayStatement as localLoad,
	savePayStatement as localSave,
} from "@/hooks/useLocalStorage";
import { getContractorByName } from "@/data/contractorDatabase";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getPayPeriodById } from "@/utils/payPeriods";

export interface SavedStatement {
	key: string; // local key or DB id
	name: string;
	date: string; // locale string
	dateISO?: string; // ISO date (YYYY-MM-DD) for filtering
	data?: PayStatementData; // eager-loaded for local; Supabase loads on demand
	contractorId?: string;
}

export interface PayStatementsClient {
	listAll(): Promise<SavedStatement[]>;
	listByContractorId(contractorId: string): Promise<SavedStatement[]>;
	save(name: string, data: PayStatementData): Promise<string | null>;
	load(key: string): Promise<PayStatementData | null>;
	delete(key: string): Promise<void>;
}

class LocalPayStatementsClient implements PayStatementsClient {
	async listAll(): Promise<SavedStatement[]> {
		const keys = localKeys();
		const statements: SavedStatement[] = [];
		keys.forEach((key) => {
			const data = localLoad(key) as PayStatementData | null;
			if (data) {
				const parts = key.split("_");
				const timestamp = parts[parts.length - 1];
				const name = parts.slice(1, -1).join("_");
				const tsNum = parseInt(timestamp);
				const dateObj = new Date(tsNum);
				const date = dateObj.toLocaleDateString();
				const dateISO = new Date(
					dateObj.getFullYear(),
					dateObj.getMonth(),
					dateObj.getDate()
				)
					.toISOString()
					.slice(0, 10);
				const contractor = getContractorByName(data.paidTo.name);
				statements.push({
					key,
					name: name || "Untitled",
					date,
					dateISO,
					data,
					contractorId: contractor?.id,
				});
			}
		});
		statements.sort((a, b) => {
			const aTime = parseInt(a.key.split("_").pop() || "0");
			const bTime = parseInt(b.key.split("_").pop() || "0");
			return bTime - aTime;
		});
		return statements;
	}

	async listByContractorId(contractorId: string): Promise<SavedStatement[]> {
		const all = await this.listAll();
		return all.filter((s) => s.contractorId === contractorId);
	}

	async save(name: string, data: PayStatementData): Promise<string | null> {
		return localSave(name, data);
	}

	async load(key: string): Promise<PayStatementData | null> {
		return localLoad(key);
	}

	async delete(key: string): Promise<void> {
		localDelete(key);
	}
}

class SupabasePayStatementsClient implements PayStatementsClient {
	async listAll(): Promise<SavedStatement[]> {
		const supabase = getSupabaseClient();
		const { data, error } = await supabase
			.from("pay_statements")
			.select("id, contractor_id, period_end, notes")
			.order("period_end", { ascending: false })
			.limit(200);
		if (error) throw error;
		return (data || []).map((row) => {
			const d = new Date(row.period_end as string);
			const dateISO = row.period_end as string;
			return {
				key: row.id as string,
				name: (row.notes as string) || "Pay Statement",
				date: d.toLocaleDateString(),
				dateISO,
				contractorId: row.contractor_id as string,
			};
		});
	}

	async listByContractorId(contractorId: string): Promise<SavedStatement[]> {
		const supabase = getSupabaseClient();
		const { data, error } = await supabase
			.from("pay_statements")
			.select("id, period_end, notes")
			.eq("contractor_id", contractorId)
			.order("period_end", { ascending: false });
		if (error) throw error;
		return (data || []).map((row) => {
			const d = new Date(row.period_end as string);
			const dateISO = row.period_end as string;
			return {
				key: row.id as string,
				name: (row.notes as string) || "Pay Statement",
				date: d.toLocaleDateString(),
				dateISO,
				contractorId,
			};
		});
	}

	async save(name: string, data: PayStatementData): Promise<string | null> {
		const supabase = getSupabaseClient();
		// Resolve contractor by name from app_contractors
		const { data: contractorRow, error: contractorErr } = await supabase
			.from("app_contractors")
			.select("id, paymentInfo, address, name")
			.eq("name", data.paidTo.name)
			.maybeSingle();
		if (contractorErr) throw contractorErr;
		if (!contractorRow) {
			throw new Error(
				`Contractor not found in Supabase: ${data.paidTo.name}. Make sure they exist in app_contractors.`
			);
		}

		const period = getPayPeriodById(data.payment.payPeriodId);
		if (!period) throw new Error("Invalid pay period selected");

		const subtotal = (data.summary || []).reduce(
			(sum, i) => sum + (i.total || 0),
			0
		);
		const subtotal_cents = Math.round(subtotal * 100);
		const total_cents = Math.round((data.totalPayment || subtotal) * 100);

		// Insert pay_statements row
		const { data: psRow, error: psErr } = await supabase
			.from("pay_statements")
			.insert({
				contractor_id: contractorRow.id,
				period_start: period.startDate,
				period_end: period.endDate,
				status: "draft",
				subtotal_cents,
				adjustments_cents: 0,
				total_cents,
				notes: data.notes || name,
			})
			.select("id")
			.single();
		if (psErr) throw psErr;
		const payStatementId = psRow.id as string;

		// Build items from summary
		const items = (data.summary || []).map((item) => ({
			pay_statement_id: payStatementId,
			building_id: null,
			description: item.description,
			unit_type: item.qtySuffix === "hrs" ? "hour" : "visit",
			rate_cents: Math.round((item.payPerVisit || 0) * 100),
			quantity: item.numberOfVisits || 1,
			line_total_cents: Math.round((item.total || 0) * 100),
			metadata: { source: "summary" },
		}));
		if (items.length > 0) {
			const { error: itemsErr } = await supabase
				.from("pay_statement_items")
				.insert(items);
			if (itemsErr) throw itemsErr;
		}

		return payStatementId;
	}

	async load(key: string): Promise<PayStatementData | null> {
		const supabase = getSupabaseClient();
		// Define light-weight row shapes for mapping
		type PsRow = {
			contractor_id: string;
			period_start: string;
			period_end: string;
			total_cents: number | null;
			notes: string | null;
		};
		type PSItemRow = {
			description: string | null;
			unit_type: "visit" | "hour" | null;
			rate_cents: number | null;
			quantity: number | null;
			line_total_cents: number | null;
		};
		type AppContractorRow = {
			name?: string | null;
			address?: { city?: string; state?: string; zipCode?: string } | null;
			paymentInfo?: { method?: string | null } | null;
		} | null;
		// Load statement row
		const { data: ps, error: psErr } = await supabase
			.from("pay_statements")
			.select("id, contractor_id, period_start, period_end, total_cents, notes")
			.eq("id", key)
			.maybeSingle();
		if (psErr) throw psErr;
		if (!ps) return null;
		const psRow = ps as unknown as PsRow;
		// Load items
		const { data: itemRows, error: itemsErr } = await supabase
			.from("pay_statement_items")
			.select("description, unit_type, rate_cents, quantity, line_total_cents")
			.eq("pay_statement_id", key);
		if (itemsErr) throw itemsErr;
		const typedItems: PSItemRow[] = (itemRows as unknown as PSItemRow[]) || [];
		// Resolve contractor
		const { data: contractor, error: cErr } = await supabase
			.from("app_contractors")
			.select("name, address, paymentInfo")
			.eq("id", psRow.contractor_id)
			.maybeSingle();
		if (cErr) throw cErr;
		const contractorRow = contractor as AppContractorRow;
		const contractorName = contractorRow?.name || "[Name]";
		const contractorAddress = (contractorRow?.address as {
			city?: string;
			state?: string;
			zipCode?: string;
		} | null) || {
			city: "",
			state: "",
			zipCode: "",
		};
		const paymentMethod =
			contractorRow?.paymentInfo?.method || "Direct Deposit";
		// Map to PayStatementData
		const statement: PayStatementData = {
			companyName: "ELEMENT CLEANING SYSTEMS LLC",
			companyAddress: {
				street: "1400 112th Ave Se",
				suite: "Suite 100",
				city: "Bellevue",
				state: "WA",
				zipCode: "98004",
			},
			companyPhone: "425-591-9427",
			paidTo: {
				name: contractorName,
				address: {
					street: "",
					city: contractorAddress?.city || "",
					state: contractorAddress?.state || "",
					zipCode: contractorAddress?.zipCode || "",
				},
			},
			payment: {
				payPeriodId: "", // unknown mapping to our generated IDs
				method: paymentMethod,
			},
			paymentDetails: typedItems.map((i) => ({
				description: i.description || "",
				amount: (i.line_total_cents || 0) / 100,
			})),
			summary: typedItems.map((i) => ({
				description: i.description || "",
				payPerVisit: (i.rate_cents || 0) / 100,
				numberOfVisits: Number(i.quantity || 0),
				qtySuffix: i.unit_type === "hour" ? "hrs" : undefined,
				total: (i.line_total_cents || 0) / 100,
			})),
			totalPayment: (psRow.total_cents || 0) / 100,
			notes: psRow.notes || undefined,
		};
		return statement;
	}

	async delete(key: string): Promise<void> {
		const supabase = getSupabaseClient();
		const { error } = await supabase
			.from("pay_statements")
			.delete()
			.eq("id", key);
		if (error) throw error;
	}
}

let psClient: PayStatementsClient | null = null;
export function getPayStatementsClient(): PayStatementsClient {
	if (psClient) return psClient;
	const backend = process.env.NEXT_PUBLIC_DATA_BACKEND || "local";
	psClient =
		backend === "supabase"
			? new SupabasePayStatementsClient()
			: new LocalPayStatementsClient();
	return psClient;
}
