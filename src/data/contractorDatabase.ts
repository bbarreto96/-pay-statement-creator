import { Contractor } from "@/types/contractor";

// Default contractor data
const defaultContractorData: Contractor[] = [
	{
		id: "contractor-001",
		name: "Asphodel Vallejo Rangel",
		address: {
			street: "6037 41st Ave SW",
			city: "Seattle",
			state: "WA",
			zipCode: "98136",
		},
		paymentInfo: {
			method: "Direct Deposit",
			accountLastFour: "1067",
		},
		buildings: [
			{
				buildingName: "Building A",
				payPerVisit: 85.0,
				isActive: true,
			},
			{
				buildingName: "Building B",
				payPerVisit: 90.0,
				isActive: true,
			},
		],
		isActive: true,
		dateAdded: "2024-01-15",
	},
	{
		id: "contractor-002",
		name: "Lisaura Brito Martinez",
		address: {
			street: "3030 NE 10th St, Apt 209",
			city: "Renton",
			state: "WA",
			zipCode: "98056",
		},
		paymentInfo: {
			method: "Direct Deposit",
			accountLastFour: "3759",
		},
		buildings: [
			{
				buildingName: "Office Complex Downtown",
				payPerVisit: 95.0,
				isActive: true,
			},
		],
		isActive: true,
		dateAdded: "2024-02-01",
	},
	{
		id: "contractor-003",
		name: "Janet Ramirez Ruiz",
		address: {
			street: "12239 16th Ave S",
			city: "Burien",
			state: "WA",
			zipCode: "98168",
		},
		paymentInfo: {
			method: "Direct Deposit",
			accountLastFour: "9449",
		},
		buildings: [
			{
				buildingName: "Medical Center West",
				payPerVisit: 110.0,
				isActive: true,
			},
			{
				buildingName: "Retail Plaza",
				payPerVisit: 75.0,
				isActive: true,
			},
		],
		isActive: true,
		dateAdded: "2024-01-20",
	},
	{
		id: "contractor-004",
		name: "Sheymy Ramirez",
		address: {
			street: "12239 16th Ave S",
			city: "Burien",
			state: "WA",
			zipCode: "98168",
		},
		paymentInfo: {
			method: "Direct Deposit",
			accountLastFour: "9303",
		},
		buildings: [
			{
				buildingName: "Tech Campus North",
				payPerVisit: 100.0,
				isActive: true,
			},
		],
		isActive: true,
		dateAdded: "2024-03-01",
	},
	{
		id: "contractor-005",
		name: "María García",
		address: {
			street: "2302 O St NE, Apt A",
			city: "Auburn",
			state: "WA",
			zipCode: "98002",
		},
		paymentInfo: {
			method: "Direct Deposit",
			accountLastFour: "2752",
		},
		buildings: [
			{
				buildingName: "Corporate Center",
				payPerVisit: 120.0,
				isActive: true,
			},
			{
				buildingName: "Warehouse District",
				payPerVisit: 80.0,
				isActive: true,
			},
		],
		isActive: true,
		dateAdded: "2024-02-15",
	},
	{
		id: "contractor-006",
		name: "Luis Lopez",
		address: {
			street: "3030 NE 10th St, Apt 209",
			city: "Renton",
			state: "WA",
			zipCode: "98056",
		},
		paymentInfo: {
			method: "Direct Deposit",
			accountLastFour: "0000",
		},
		buildings: [
			{
				buildingName: "Shopping Center East",
				payPerVisit: 85.0,
				isActive: true,
			},
		],
		isActive: true,
		dateAdded: "2024-03-10",
	},
];

// localStorage key for contractor data
const CONTRACTOR_STORAGE_KEY = "element-cleaning-contractors";

// Load contractors from localStorage or use default data
const loadContractors = (): Contractor[] => {
	if (typeof window === "undefined") {
		// Server-side rendering - return default data
		return defaultContractorData;
	}

	try {
		const stored = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Validate that it's an array and has the expected structure
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		}
	} catch (error) {
		console.warn("Failed to load contractors from localStorage:", error);
	}

	// If no valid data in localStorage, use default and save it
	saveContractors(defaultContractorData);
	return defaultContractorData;
};

// Save contractors to localStorage
const saveContractors = (contractors: Contractor[]): void => {
	if (typeof window === "undefined") {
		return; // Skip on server-side
	}

	try {
		localStorage.setItem(CONTRACTOR_STORAGE_KEY, JSON.stringify(contractors));
	} catch (error) {
		console.warn("Failed to save contractors to localStorage:", error);
	}
};

// Initialize contractor database with persistent data
export const contractorDatabase: Contractor[] = loadContractors();

// Helper functions for contractor database operations
export const getActiveContractors = (): Contractor[] => {
	return contractorDatabase.filter((contractor) => contractor.isActive);
};

export const getContractorById = (id: string): Contractor | undefined => {
	return contractorDatabase.find((contractor) => contractor.id === id);
};

export const getContractorByName = (name: string): Contractor | undefined => {
	return contractorDatabase.find((contractor) =>
		contractor.name.toLowerCase().includes(name.toLowerCase())
	);
};

export const addContractor = (
	contractor: Omit<Contractor, "id" | "dateAdded">
): Contractor => {
	const newContractor: Contractor = {
		...contractor,
		id: `contractor-${Date.now()}`,
		dateAdded: new Date().toISOString().split("T")[0],
	};
	contractorDatabase.push(newContractor);
	saveContractors(contractorDatabase);
	return newContractor;
};

export const updateContractor = (
	id: string,
	updates: Partial<Contractor>
): boolean => {
	const index = contractorDatabase.findIndex(
		(contractor) => contractor.id === id
	);
	if (index !== -1) {
		contractorDatabase[index] = { ...contractorDatabase[index], ...updates };
		saveContractors(contractorDatabase);
		return true;
	}
	return false;
};

export const deactivateContractor = (id: string): boolean => {
	return updateContractor(id, { isActive: false });
};

// Refresh contractor database from localStorage (useful for components)
export const refreshContractorDatabase = (): void => {
	contractorDatabase.length = 0; // Clear current array
	contractorDatabase.push(...loadContractors()); // Reload from localStorage
};

// Export function to manually save current state
export const saveCurrentContractors = (): void => {
	saveContractors(contractorDatabase);
};

// Clear localStorage and reset to default data (for testing/reset purposes)
export const resetContractorDatabase = (): void => {
	if (typeof window !== "undefined") {
		localStorage.removeItem(CONTRACTOR_STORAGE_KEY);
	}
	contractorDatabase.length = 0;
	contractorDatabase.push(...defaultContractorData);
	saveContractors(contractorDatabase);
};
