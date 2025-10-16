import { Contractor } from "@/types/contractor";
import { DataClient } from ".";
import { getSupabaseClient } from "@/lib/supabase/client";

type AppContractorRow = {
	id?: string;
	name: string;
	address: unknown;
	paymentInfo: unknown;
	buildings: unknown;
	isActive: boolean;
	dateAdded?: string;
	notes?: string | null;
	created_at?: string;
	updated_at?: string;
};

export class SupabaseDataClient implements DataClient {
	async listActiveContractors(): Promise<Contractor[]> {
		const supabase = getSupabaseClient();
		const { data, error } = await supabase
			.from("app_contractors")
			.select("*")
			.eq("isActive", true)
			.order("name");
		if (error) throw error;
		return (data || []) as Contractor[];
	}

	async listAllContractors(): Promise<Contractor[]> {
		const supabase = getSupabaseClient();
		const { data, error } = await supabase
			.from("app_contractors")
			.select("*")
			.order("name");
		if (error) throw error;
		return (data || []) as Contractor[];
	}

	async getContractorById(id: string): Promise<Contractor | null> {
		const supabase = getSupabaseClient();
		const { data, error } = await supabase
			.from("app_contractors")
			.select("*")
			.eq("id", id)
			.maybeSingle();
		if (error) throw error;
		return (data as Contractor) || null;
	}

	async addContractor(
		c: Omit<Contractor, "id" | "dateAdded">
	): Promise<Contractor> {
		const supabase = getSupabaseClient();
		const payload: AppContractorRow = {
			name: c.name,
			address: c.address,
			paymentInfo: c.paymentInfo,
			buildings: c.buildings,
			isActive: c.isActive ?? true,
			notes: c.notes ?? null,
		};
		const { data, error } = await supabase
			.from("app_contractors")
			.insert(payload)
			.select("*")
			.single();
		if (error) throw error;
		return data as unknown as Contractor;
	}

	async updateContractor(
		id: string,
		updates: Partial<Contractor>
	): Promise<boolean> {
		const supabase = getSupabaseClient();
		// Only include columns that exist in the table to avoid errors like
		// "column does not exist" (e.g., googleDriveFolderId is not in app_contractors)
		const payload: Partial<AppContractorRow> = {};
		if (typeof updates.name !== "undefined")
			payload.name = updates.name as string;
		if (typeof updates.address !== "undefined")
			payload.address = updates.address as unknown;
		if (typeof updates.paymentInfo !== "undefined")
			payload.paymentInfo = updates.paymentInfo as unknown;
		if (typeof updates.buildings !== "undefined")
			payload.buildings = updates.buildings as unknown;
		if (typeof updates.isActive === "boolean")
			payload.isActive = updates.isActive;
		if (Object.prototype.hasOwnProperty.call(updates, "notes"))
			payload.notes = (updates as { notes?: string | null }).notes ?? null;

		const { error } = await supabase
			.from("app_contractors")
			.update(payload)
			.eq("id", id);
		if (error) throw error;
		return true;
	}
}
