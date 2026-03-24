const STORAGE_KEY = "company-config";

export interface CompanyConfig {
	name: string;
	phone: string;
	address: {
		street: string;
		suite?: string;
		city: string;
		state: string;
		zipCode: string;
	};
}

const DEFAULT: CompanyConfig = {
	name: "ELEMENT CLEANING SYSTEMS LLC",
	phone: "425-591-9427",
	address: {
		street: "1400 112th Ave Se",
		suite: "Suite 100",
		city: "Bellevue",
		state: "WA",
		zipCode: "98004",
	},
};

export function getCompanyConfig(): CompanyConfig {
	try {
		if (typeof window === "undefined") return DEFAULT;
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT;
		return { ...DEFAULT, ...JSON.parse(raw) };
	} catch {
		return DEFAULT;
	}
}

export function saveCompanyConfig(config: CompanyConfig): void {
	try {
		if (typeof window === "undefined") return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {}
}
