export interface Contractor {
	id: string;
	name: string;
	address: {
		street?: string;
		city: string;
		state: string;
		zipCode: string;
	};
	paymentInfo: {
		method: "Direct Deposit" | "Check" | "Cash" | "Wire Transfer";
		accountLastFour: string; // Last 4 digits of bank account
	};
	buildings: BuildingAssignment[];
	isActive: boolean;
	dateAdded: string;
	notes?: string;
	googleDriveFolderId?: string; // optional: link to Drive folder
}

export interface BuildingAssignment {
	buildingName: string;
	payType?: "perVisit" | "hourly";
	payPerVisit: number;
	isActive: boolean;
	hourlyRate?: number;
}

export interface ContractorDatabase {
	contractors: Contractor[];
	lastUpdated: string;
}
