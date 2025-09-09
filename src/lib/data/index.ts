import { Contractor } from "@/types/contractor";
import * as contractorDB from "@/data/contractorDatabase";
import { SupabaseDataClient } from "./supabaseAdapter";

export interface DataClient {
	listActiveContractors(): Promise<Contractor[]>;
	listAllContractors(): Promise<Contractor[]>;
	getContractorById(id: string): Promise<Contractor | null>;
	addContractor(c: Omit<Contractor, "id" | "dateAdded">): Promise<Contractor>;
	updateContractor(id: string, updates: Partial<Contractor>): Promise<boolean>;
}

class LocalDataClient implements DataClient {
	async listActiveContractors(): Promise<Contractor[]> {
		return contractorDB.getActiveContractors();
	}
	async listAllContractors(): Promise<Contractor[]> {
		return contractorDB.contractorDatabase; // includes active and inactive
	}
	async getContractorById(id: string): Promise<Contractor | null> {
		return contractorDB.getContractorById(id) || null;
	}
	async addContractor(
		c: Omit<Contractor, "id" | "dateAdded">
	): Promise<Contractor> {
		return contractorDB.addContractor(c);
	}
	async updateContractor(
		id: string,
		updates: Partial<Contractor>
	): Promise<boolean> {
		return contractorDB.updateContractor(id, updates);
	}
}

let client: DataClient | null = null;

export function getDataClient(): DataClient {
	if (client) return client;
	const backend = process.env.NEXT_PUBLIC_DATA_BACKEND || "local";
	if (backend === "supabase") {
		client = new SupabaseDataClient();
	} else {
		client = new LocalDataClient();
	}
	return client;
}
